"use server";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import sharp from "sharp";
import {
  database,
  identity,
  requireMember,
  serviceDatabase,
  portalUrl,
  checked,
} from "./supabase";
import {
  profileSchema,
  uuid,
  password,
  safeNext,
  httpsUrl,
} from "./validation";
import { rateLimit, authRate } from "./limits";
import { deliverEventEmails, scheduleEventEmailDelivery } from "./email";

export type FormState = { error?: string; success?: string };
const text = (f: FormData, key: string) => String(f.get(key) || "").trim();
const raw = (f: FormData, key: string) => String(f.get(key) || "");
const id = (f: FormData, key = "id") => uuid.parse(text(f, key));
function profile(f: FormData) {
  return profileSchema.parse({
    display_name: text(f, "display_name"),
    title: text(f, "title"),
    company: text(f, "company"),
    bio: text(f, "bio"),
    city: text(f, "city"),
    region: text(f, "region"),
    country: text(f, "country"),
    directory_visible: f.get("directory_visible") === "on",
  });
}
function recoverySignature(value: string) {
  return createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY!)
    .update(value)
    .digest("hex");
}

export async function formAction(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    return await perform(form);
  } catch (error) {
    unstable_rethrow(error);
    return {
      error:
        error instanceof z.ZodError
          ? error.issues
              .map((i) => `${i.path.join(".") || "Field"}: ${i.message}`)
              .join(" ")
          : error instanceof Error
            ? error.message
            : "Please try again.",
    };
  }
}

async function perform(form: FormData): Promise<FormState> {
  const action = text(form, "action");
  if (action === "login") {
    const email = z.email().parse(text(form, "email"));
    await authRate("login", email);
    const db = await database();
    const { error } = await db.auth.signInWithPassword({
      email,
      password: raw(form, "password"),
    });
    if (error) return { error: "Email or password was not recognized." };
    redirect(safeNext(text(form, "next")));
  }
  if (action === "forgot") {
    const email = z.email().parse(text(form, "email"));
    await authRate("recovery", email);
    const db = await database();
    await db.auth.resetPasswordForEmail(email, {
      redirectTo: `${portalUrl()}/auth/confirm`,
    });
    return {
      success:
        "If that address has an account, a password reset email is on its way.",
    };
  }
  if (action === "confirm") {
    const type = z.enum(["invite", "recovery"]).parse(text(form, "type"));
    const token_hash = z
      .string()
      .min(16)
      .max(512)
      .parse(text(form, "token_hash"));
    await authRate(
      "confirm",
      createHash("sha256").update(token_hash).digest("hex"),
    );
    const db = await database();
    const { data, error } = await db.auth.verifyOtp({ token_hash, type });
    if (error || !data.user)
      return {
        error:
          "This link has expired or has already been used. Request a new email.",
      };
    const value = `${data.user.id}:${Date.now()}:${type}`;
    (await cookies()).set(
      "cnb-password-proof",
      `${value}:${recoverySignature(value)}`,
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 900,
        path: "/",
      },
    );
    redirect("/reset-password");
  }
  if (action === "reset") {
    const db = await database();
    const {
      data: { user },
    } = await db.auth.getUser();
    const jar = await cookies();
    const proof = jar.get("cnb-password-proof")?.value || "";
    const parts = proof.split(":");
    const value = parts.slice(0, 3).join(":");
    const signature = parts[3] || "";
    if (
      !user ||
      parts.length !== 4 ||
      parts[0] !== user.id ||
      !Number.isFinite(Number(parts[1])) ||
      Math.abs(Date.now() - Number(parts[1])) > 900000 ||
      !/^[0-9a-f]{64}$/.test(signature) ||
      !timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(recoverySignature(value)),
      )
    )
      throw new Error("Open a fresh invitation or password reset email.");
    const nextPassword = password.parse(raw(form, "password"));
    if (nextPassword !== raw(form, "confirm_password"))
      throw new Error("Passwords do not match.");
    const { error } = await db.auth.updateUser({ password: nextPassword });
    if (error) throw new Error(error.message);
    jar.delete("cnb-password-proof");
    await db.auth.signOut({ scope: "others" });
    redirect(parts[2] === "invite" ? "/onboarding" : "/");
  }
  if (action === "logout") {
    const db = await database();
    await db.auth.signOut();
    redirect("/login");
  }
  if (action === "onboard") {
    const { db, membership } = await identity();
    if (membership.status !== "invited") redirect("/");
    if (
      !process.env.POLICY_VERSION ||
      !process.env.TERMS_URL ||
      !process.env.PRIVACY_URL
    )
      throw new Error(
        "Membership enrollment is being prepared. Please contact Amanda.",
      );
    if (form.get("consent") !== "on")
      throw new Error("Please accept the membership terms and privacy policy.");
    checked(
      await db.rpc("finish_onboarding", {
        profile: profile(form),
        terms: z.array(uuid).parse(form.getAll("terms")),
        policy: process.env.POLICY_VERSION,
      }),
    );
    redirect("/");
  }
  const { db, user, membership } = await requireMember(
    action.startsWith("admin-"),
  );
  await rateLimit(action, user.id, action === "comment" ? 40 : 30);
  if (action === "profile")
    checked(
      await db.rpc("update_profile", {
        profile: profile(form),
        terms: z.array(uuid).parse(form.getAll("terms")),
      }),
    );
  else if (action === "avatar") {
    const file = form.get("file");
    if (
      !(file instanceof File) ||
      file.size > 3 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    )
      throw new Error("Choose a JPEG, PNG, or WebP image under 3 MB.");
    const bytes = await sharp(Buffer.from(await file.arrayBuffer()), {
      limitInputPixels: 40000000,
    })
      .rotate()
      .resize(640, 640, { fit: "cover" })
      .webp({ quality: 86 })
      .toBuffer();
    const path = `${user.id}/${crypto.randomUUID()}.webp`;
    const old = checked(
      await db
        .from("member_profiles")
        .select("avatar_path")
        .eq("user_id", user.id)
        .single(),
    );
    checked(
      await db.storage
        .from("member-avatars")
        .upload(path, bytes, { contentType: "image/webp" }),
    );
    const result = await db
      .from("member_profiles")
      .update({ avatar_path: path })
      .eq("user_id", user.id);
    if (result.error) {
      await db.storage.from("member-avatars").remove([path]);
      checked(result);
    }
    if (old?.avatar_path)
      await db.storage.from("member-avatars").remove([old.avatar_path]);
  } else if (action === "save") {
    const resource_id = id(form);
    if (text(form, "saved") === "true")
      checked(
        await db
          .from("saved_resources")
          .delete()
          .eq("member_id", user.id)
          .eq("resource_id", resource_id),
      );
    else {
      const result = await db
        .from("saved_resources")
        .insert({ member_id: user.id, resource_id });
      if (result.error?.code !== "23505") checked(result);
    }
  } else if (action === "rsvp") {
    const response = checked(
      await db.rpc("rsvp", {
        target: id(form),
        answer: z.enum(["yes", "no"]).parse(text(form, "answer")),
        note: text(form, "note"),
      }),
    );
    scheduleEventEmailDelivery();
    revalidatePath("/", "layout");
    return {
      success:
        response === "waitlist"
          ? "You are on the waiting list. We will email you when a place opens."
          : "Your RSVP has been updated.",
    };
  } else if (action === "thread") {
    const data = checked(
      await db
        .from("discussion_threads")
        .insert({
          author_id: user.id,
          title: z.string().min(3).max(200).parse(text(form, "title")),
          body: z.string().min(1).max(10000).parse(text(form, "body")),
        })
        .select("id")
        .single(),
    );
    redirect(`/community/${data.id}`);
  } else if (action === "comment")
    checked(
      await db.from("discussion_comments").insert({
        author_id: user.id,
        thread_id: id(form),
        body: z.string().min(1).max(5000).parse(text(form, "body")),
        parent_id: text(form, "parent_id")
          ? uuid.parse(text(form, "parent_id"))
          : null,
      }),
    );
  else if (action === "discussion-save") {
    const thread_id = id(form);
    if (text(form, "active") === "true")
      checked(
        await db
          .from("discussion_saves")
          .delete()
          .eq("member_id", user.id)
          .eq("thread_id", thread_id),
      );
    else {
      const result = await db
        .from("discussion_saves")
        .insert({ member_id: user.id, thread_id });
      if (result.error?.code !== "23505") checked(result);
    }
  } else if (action === "discussion-appreciate") {
    const thread_id = id(form);
    if (text(form, "active") === "true")
      checked(
        await db
          .from("discussion_appreciations")
          .delete()
          .eq("member_id", user.id)
          .eq("thread_id", thread_id),
      );
    else {
      const result = await db
        .from("discussion_appreciations")
        .insert({ member_id: user.id, thread_id });
      if (result.error?.code !== "23505") checked(result);
    }
  } else if (action === "edit-discussion") {
    const remove = form.get("remove") === "true";
    checked(
      await db.rpc("edit_discussion", {
        kind: z.enum(["thread", "comment"]).parse(text(form, "kind")),
        target: id(form),
        body_text: remove
          ? ""
          : z.string().min(1).max(10000).parse(text(form, "body")),
        heading: text(form, "title") || null,
        remove,
      }),
    );
    if (remove && text(form, "kind") === "thread") redirect("/community");
  } else if (action === "report") {
    const targetType = z
      .enum(["thread", "comment", "member"])
      .parse(text(form, "target_type"));
    const target = id(form);
    const report = {
      reporter_id: user.id,
      thread_id: targetType === "thread" ? target : null,
      comment_id: targetType === "comment" ? target : null,
      reported_member_id: targetType === "member" ? target : null,
      reason: z.string().min(3).max(1000).parse(text(form, "reason")),
    };
    if (targetType === "comment") {
      const comment = checked(
        await db
          .from("discussion_comments")
          .select("thread_id")
          .eq("id", target)
          .single(),
      );
      report.thread_id = comment.thread_id;
    }
    const result = await db.from("discussion_reports").insert(report);
    if (result.error?.code === "23505")
      throw new Error("You have already reported this item for review.");
    checked(result);
  } else if (action === "intro")
    checked(
      await db.from("introduction_requests").insert({
        requester_id: user.id,
        target_id: id(form),
        context: z.string().min(10).max(2000).parse(text(form, "context")),
      }),
    );
  else if (action === "sessions") {
    await db.auth.signOut({ scope: "others" });
  } else if (action === "password") {
    const { error } = await db.auth.signInWithPassword({
      email: user.email!,
      password: raw(form, "current_password"),
    });
    if (error) throw new Error("Current password is incorrect.");
    const nextPassword = password.parse(raw(form, "password"));
    if (nextPassword !== raw(form, "confirm_password"))
      throw new Error("Passwords do not match.");
    const updated = await db.auth.updateUser({ password: nextPassword });
    if (updated.error) throw new Error(updated.error.message);
    await db.auth.signOut({ scope: "others" });
  } else if (action === "admin-member")
    checked(
      await db.rpc("admin_member", {
        target: id(form),
        new_status: z
          .enum(["active", "suspended", "revoked"])
          .parse(text(form, "status")),
        reason: text(form, "reason"),
      }),
    );
  else if (action === "admin-warning")
    checked(
      await db.rpc("issue_member_warning", {
        target: id(form),
        message: z.string().min(10).max(2000).parse(text(form, "message")),
        reason: z.string().min(3).max(1000).parse(text(form, "reason")),
      }),
    );
  else if (action === "admin-invite") {
    if (
      !process.env.POLICY_VERSION ||
      !process.env.TERMS_URL ||
      !process.env.PRIVACY_URL
    )
      throw new Error(
        "Set the approved policy URLs and version before inviting members.",
      );
    const email = z.email().parse(text(form, "email")).toLowerCase();
    const existing = checked(
      await db
        .from("member_invitations")
        .select("accepted_at,auth_user_id")
        .eq("email", email)
        .maybeSingle(),
    );
    if (existing?.accepted_at)
      throw new Error(
        "This invitation was already accepted. Manage the existing member instead.",
      );
    checked(
      await db.from("member_invitations").upsert(
        {
          email,
          invited_by: user.id,
          expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        },
        { onConflict: "email" },
      ),
    );
    const result = existing?.auth_user_id
      ? await db.auth.resetPasswordForEmail(email, {
          redirectTo: `${portalUrl()}/auth/confirm`,
        })
      : await serviceDatabase().auth.admin.inviteUserByEmail(email, {
          redirectTo: `${portalUrl()}/auth/confirm`,
        });
    if (result.error)
      throw new Error(
        "Invitation email could not be sent. Check the email provider and existing account before retrying.",
      );
  } else if (action === "admin-event-details")
    checked(
      await db.from("event_details").upsert({
        event_id: id(form),
        instructions: z.string().max(5000).parse(text(form, "instructions")),
        meeting_url: text(form, "meeting_url")
          ? httpsUrl(text(form, "meeting_url"))
          : null,
        materials_resource_id: text(form, "resource_id")
          ? uuid.parse(text(form, "resource_id"))
          : null,
      }),
    );
  else if (action === "admin-event-invite") {
    const event_id = id(form),
      member_id = id(form, "member_id");
    checked(await db.from("event_invitations").upsert({ event_id, member_id }));
    checked(
      await serviceDatabase()
        .from("email_outbox")
        .upsert(
          {
            recipient_id: member_id,
            kind: "event-invitation",
            event_id,
            dedupe_key: `invite:${event_id}:${member_id}`,
          },
          { onConflict: "dedupe_key", ignoreDuplicates: true },
        ),
    );
    scheduleEventEmailDelivery();
  } else if (action === "admin-send-email") {
    const delivery = await deliverEventEmails(true);
    revalidatePath("/admin/audit");
    return {
      success: `${delivery.sent} sent, ${delivery.skipped} skipped, ${delivery.failed} failed.${delivery.deferred ? " More mail remains queued or delivery is not configured; check the queue below." : ""}`,
    };
  } else if (action === "admin-thread")
    checked(
      await db.rpc("moderate_thread", {
        target: id(form),
        new_status: z
          .enum(["open", "locked", "hidden"])
          .parse(text(form, "status")),
        pin: form.get("pinned") === "on",
      }),
    );
  else if (action === "admin-comment")
    checked(
      await db.rpc("moderate_comment", {
        target: id(form),
        hide: text(form, "hidden") === "true",
      }),
    );
  else if (action === "admin-report")
    checked(
      await db
        .from("discussion_reports")
        .update({ resolved: true })
        .eq("id", id(form)),
    );
  else if (action === "admin-intro") {
    checked(
      await db
        .from("introduction_requests")
        .update({
          status: z
            .enum(["pending", "accepted", "declined", "completed"])
            .parse(text(form, "status")),
        })
        .eq("id", id(form)),
    );
    if (text(form, "note"))
      checked(
        await db.from("admin_notes").insert({
          target_type: "introduction",
          target_id: id(form),
          body: text(form, "note"),
        }),
      );
  } else if (action === "admin-profile") {
    checked(
      await serviceDatabase()
        .from("member_profiles")
        .update({ directory_visible: false })
        .eq("user_id", id(form)),
    );
  } else if (action === "admin-media") {
    const file = form.get("file");
    if (
      !(file instanceof File) ||
      !file.size ||
      file.size > 3 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    )
      throw new Error("Choose a JPEG, PNG, or WebP image under 3 MB.");
    const alt = z.string().min(1).max(500).parse(text(form, "alt"));
    const { data: bytes, info } = await sharp(
      Buffer.from(await file.arrayBuffer()),
      { limitInputPixels: 40000000 },
    )
      .rotate()
      .resize({
        width: 2000,
        height: 2000,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 86 })
      .toBuffer({ resolveWithObject: true });
    if (bytes.length > 3 * 1024 * 1024)
      throw new Error(
        "The processed image is too large. Choose a smaller image.",
      );
    const assetId = crypto.randomUUID(),
      path = `${assetId}.webp`;
    checked(
      await db.storage
        .from("editorial-images")
        .upload(path, bytes, { contentType: "image/webp" }),
    );
    const inserted = await db.from("editorial_media").insert({
      id: assetId,
      path,
      name: file.name.slice(0, 180),
      alt,
      bytes: bytes.length,
      width: info.width,
      height: info.height,
    });
    if (inserted.error) {
      await db.storage.from("editorial-images").remove([path]);
      checked(inserted);
    }
    checked(
      await db.from("audit_events").insert({
        actor_id: user.id,
        action: "admin-media-upload",
        target: assetId,
      }),
    );
    revalidatePath("/admin/media");
    return { success: `Image uploaded. Image Asset ID: ${assetId}` };
  } else if (action === "admin-media-edit") {
    checked(
      await db
        .from("editorial_media")
        .update({
          alt: z.string().min(1).max(500).parse(text(form, "alt")),
          focal_x: z.coerce
            .number()
            .int()
            .min(0)
            .max(100)
            .parse(text(form, "focal_x")),
          focal_y: z.coerce
            .number()
            .int()
            .min(0)
            .max(100)
            .parse(text(form, "focal_y")),
          archived: form.get("archived") === "on",
        })
        .eq("id", id(form)),
    );
  } else if (action === "admin-review-email") {
    checked(
      await db.rpc("review_portal_email", {
        target: id(form),
        decision: z
          .enum(["sent", "retry", "skip"])
          .parse(text(form, "decision")),
        reason: z.string().min(10).max(1000).parse(text(form, "reason")),
      }),
    );
    scheduleEventEmailDelivery();
  } else if (action === "admin-file") {
    const file = form.get("file");
    if (
      !(file instanceof File) ||
      file.type !== "application/pdf" ||
      file.size > 3 * 1024 * 1024
    )
      throw new Error("Choose a PDF under 3 MB.");
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.subarray(0, 5).toString() !== "%PDF-")
      throw new Error("The uploaded file is not a valid PDF.");
    const path = `${crypto.randomUUID()}.pdf`;
    checked(
      await db.storage
        .from("member-resources")
        .upload(path, buffer, { contentType: "application/pdf" }),
    );
    const inserted = await db
      .from("file_assets")
      .insert({
        path,
        name: file.name.slice(0, 180),
        mime: file.type,
        bytes: file.size,
        checksum: createHash("sha256").update(buffer).digest("hex"),
      })
      .select("id")
      .single();
    if (inserted.error) {
      await db.storage.from("member-resources").remove([path]);
      checked(inserted);
    }
    revalidatePath("/admin/resources");
    return { success: `File uploaded. File Asset ID: ${inserted.data!.id}` };
  } else if (
    action === "admin-publish" ||
    action === "admin-preview" ||
    action === "admin-rollback"
  ) {
    const { publishFromSheet, rollbackRevision } = await import("./cms/server");
    const result =
      action === "admin-rollback"
        ? await rollbackRevision(
            id(form),
            user.id,
            z.string().min(3).max(1000).parse(text(form, "reason")),
          )
        : await publishFromSheet(action === "admin-preview", user.id);
    revalidatePath("/", "layout");
    return { success: result };
  } else throw new Error("Unknown action.");
  if (membership.role === "admin" && action.startsWith("admin-"))
    checked(
      await serviceDatabase()
        .from("audit_events")
        .insert({
          actor_id: user.id,
          action,
          target: text(form, "id") || null,
        }),
    );
  revalidatePath("/", "layout");
  return { success: "Saved." };
}
