// Install in a PRIVATE workbook. Never publish these tabs to the web.
// If another onOpen exists, call cnbPortalMenu() from it instead of replacing it.
function onOpen() { cnbPortalMenu(); }
function cnbPortalMenu() {
  SpreadsheetApp.getUi().createMenu('C+B Portal')
    .addItem('Preview changes','cnbPortalPreview')
    .addItem('Publish changes','cnbPortalPublish')
    .addSeparator().addItem('Add Library resource','cnbPortalAddResource')
    .addItem('Add advisory board','cnbPortalAddBoard')
    .addItem('Add dinner','cnbPortalAddDinner')
    .addItem('Import staging editorial demo','cnbPortalImportStagingDemo')
    .addItem('Add taxonomy term','cnbPortalAddTerm')
    .addSeparator().addItem('Add page section','cnbPortalAddSection')
    .addItem('Duplicate selected section','cnbPortalDuplicateSection')
    .addItem('Set selected section order','cnbPortalOrderSection')
    .addItem('Archive selected section','cnbPortalArchiveSection')
    .addItem('Open visual page preview','cnbPortalVisualPreview')
    .addItem('Open image library','cnbPortalMediaLibrary')
    .addSeparator().addItem('Format workbook','cnbPortalFormatWorkbook')
    .addItem('Import starter ZIP (empty workbook only)','cnbPortalImportDialog')
    .addToUi();
}
function cnbPortalPreview() { cnbPortalSend(true); }
function cnbPortalPublish() {
  var ui=SpreadsheetApp.getUi();
  if(ui.alert('Publish member content?','This publishes the complete workbook. Missing resources are archived.',ui.ButtonSet.YES_NO)===ui.Button.YES) cnbPortalSend(false);
}
function cnbPortalSend(preview) {
  var properties=PropertiesService.getScriptProperties();
  var url=properties.getProperty('PORTAL_URL'),secret=properties.getProperty('SHEET_PUBLISH_SECRET');
  if(!url || !/^https:\/\//.test(url) || !secret) throw new Error('Ask your developer to connect this private workbook to the portal.');
  var body=JSON.stringify({workbook:SpreadsheetApp.getActive().getId(),timestamp:Date.now(),nonce:Utilities.getUuid(),preview:preview});
  var signature=Utilities.computeHmacSha256Signature(body,secret).map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2);}).join('');
  var response=UrlFetchApp.fetch(url.replace(/\/$/,'')+'/api/cms',{method:'post',contentType:'application/json',payload:body,headers:{'x-cnb-signature':signature},muteHttpExceptions:true});
  var data;try{data=JSON.parse(response.getContentText());}catch(e){throw new Error('The portal is unavailable. Your previous content remains live.');}
  SpreadsheetApp.getUi().alert(data.message||data.error||'The portal could not process the workbook.');
}
function cnbPortalRows(tab,fields) {
  var book=SpreadsheetApp.getActive(),sheet=book.getSheetByName(tab);
  if(!sheet){sheet=book.insertSheet(tab);sheet.appendRow(['section','field','value','link','notes']);}
  var key='item-'+Utilities.getUuid(),start=sheet.getLastRow()+1;
  var rows=fields.map(function(f){return [key,f[0],f[1]||'','',''];});
  sheet.getRange(start,1,rows.length,5).setNumberFormat('@').setValues(rows);
  sheet.getRange(start,1,rows.length,5).setBackground('#f6f1ea');sheet.setFrozenRows(1);
  sheet.autoResizeColumn(2);sheet.setColumnWidth(3,480);sheet.getRange(start,3,rows.length,1).setWrap(true);
  var protection=sheet.getRange(start,1,1,3).protect().setDescription('Permanent record identity');protection.setWarningOnly(true);
  book.setActiveSheet(sheet);sheet.setActiveRange(sheet.getRange(start+1,3));
}
function cnbPortalAddResource(){cnbPortalRows('Library Resources',[
 ['Resource ID',Utilities.getUuid()],['Title','New resource'],['Slug','resource-'+Utilities.getUuid()],['Status','Draft'],['Access','Member'],['Type','Essay'],['Summary',''],['Body',''],['Author','Amanda Johnson'],['Publish Date',''],['Topic 1',''],['File Asset ID',''],['Display Order','10']]);}
function cnbPortalAddBoard(){cnbPortalEvent('Advisory Boards');}
function cnbPortalAddDinner(){cnbPortalEvent('Blind Dinner Events');}
function cnbPortalEvent(tab){cnbPortalRows(tab,[['Event ID',Utilities.getUuid()],['Title','New gathering'],['Description',''],['Status','Draft'],['Starts At','2026-10-01T18:00:00-04:00'],['Ends At','2026-10-01T19:30:00-04:00'],['Timezone','America/New_York'],['Capacity','20'],['Location Label','']]);}
function cnbPortalAppendGroup(tab,key,fields){
  var sheet=SpreadsheetApp.getActive().getSheetByName(tab);
  if(!sheet)throw new Error('Missing '+tab+' tab. Import the starter workbook first.');
  var values=sheet.getDataRange().getDisplayValues();
  if(values.slice(1).some(function(row){return row[0]===key;}))return false;
  var rows=fields.map(function(f){return [key,f[0],f[1]||'',f[2]||'',f[3]||''];});
  var start=sheet.getLastRow()+1;sheet.getRange(start,1,rows.length,5).setNumberFormat('@').setValues(rows);
  return true;
}
function cnbPortalSetDefault(tab,key,field,value){
  var sheet=SpreadsheetApp.getActive().getSheetByName(tab);
  if(!sheet)throw new Error('Missing '+tab+' tab. Import the starter workbook first.');
  var values=sheet.getDataRange().getDisplayValues();
  for(var i=1;i<values.length;i++){
    if(values[i][0]===key&&values[i][1]===field){if(!values[i][2])sheet.getRange(i+1,3).setValue(value);return;}
  }
  sheet.appendRow([key,field,value,'','Staging default; replace with Amanda-approved community guidelines before launch.']);
}
function cnbPortalImportStagingDemo(){
  var ui=SpreadsheetApp.getUi();
  if(ui.alert('Import staging editorial demo?','Adds four clearly marked demo Library resources and four demo gatherings to this private workbook. Existing rows are not changed.',ui.ButtonSet.YES_NO)!==ui.Button.YES)return;
  var resources=[
    ['21000000-0000-4000-8000-000000000001',[['Resource ID','21000000-0000-4000-8000-000000000001'],['Title','Questions before the answer (Demo)'],['Slug','questions-before-the-answer'],['Status','Published'],['Access','Member'],['Type','Essay'],['Summary','A short reflection on improving a consequential decision before trying to resolve it.'],['Body','Begin by naming what would have to be true for each available path to become wise. Then ask which assumption deserves evidence before commitment.'],['Author','The Decision Room'],['Publish Date','2026-09-01T00:00:00-04:00'],['Topic 1','Decision Making'],['Display Order','10']]],
    ['21000000-0000-4000-8000-000000000002',[['Resource ID','21000000-0000-4000-8000-000000000002'],['Title','A responsible AI conversation (Demo)'],['Slug','responsible-ai-conversation'],['Status','Published'],['Access','Member'],['Type','AI Prompt'],['Summary','Prompts for moving an AI discussion beyond efficiency and toward judgment, accountability, and trust.'],['Body','Use these questions with a leadership team: Where must human judgment remain visible? Who can challenge the system? What would responsible failure look like?'],['Author','The Decision Room'],['Publish Date','2026-09-02T00:00:00-04:00'],['Topic 1','AI'],['Display Order','20']]],
    ['21000000-0000-4000-8000-000000000003',[['Resource ID','21000000-0000-4000-8000-000000000003'],['Title','The decision-ready board brief (Demo)'],['Slug','board-decision-brief'],['Status','Published'],['Access','Member'],['Type','Decision Brief'],['Summary','A concise structure for giving a board enough context to offer useful counsel.'],['Body','State the decision, the tension, the options already considered, the constraints that cannot move, and the perspective you need from the room.'],['Author','The Decision Room'],['Publish Date','2026-09-03T00:00:00-04:00'],['Topic 1','Leadership'],['Display Order','30']]],
    ['21000000-0000-4000-8000-000000000004',[['Resource ID','21000000-0000-4000-8000-000000000004'],['Title','Growth without hidden debt (Demo)'],['Slug','growth-without-hidden-debt'],['Status','Published'],['Access','Member'],['Type','Business Case'],['Summary','A fictional case about recognizing when organizational momentum begins borrowing from the future.'],['Body','A founder must choose between a faster milestone and a pace her team can sustain. Consider which signals distinguish healthy stretch from operational debt.'],['Author','The Decision Room'],['Publish Date','2026-09-04T00:00:00-04:00'],['Topic 1','Strategy'],['Display Order','40']]]
  ];
  var boards=[
    ['31000000-0000-4000-8000-000000000001',[['Event ID','31000000-0000-4000-8000-000000000001'],['Title','The September Decision Room (Demo)'],['Description','A facilitated monthly board for one consequential question.'],['Status','Published'],['Starts At','2026-09-19T18:00:00-04:00'],['Ends At','2026-09-19T19:30:00-04:00'],['Timezone','America/New_York'],['Capacity','12'],['Location Label','Private video room']]],
    ['31000000-0000-4000-8000-000000000002',[['Event ID','31000000-0000-4000-8000-000000000002'],['Title','The October Decision Room (Demo)'],['Description','Bring a live decision and leave with a clearer next move.'],['Status','Published'],['Starts At','2026-10-17T18:00:00-04:00'],['Ends At','2026-10-17T19:30:00-04:00'],['Timezone','America/New_York'],['Capacity','12'],['Location Label','Private video room']]]
  ];
  var dinners=[
    ['31000000-0000-4000-8000-000000000003',[['Event ID','31000000-0000-4000-8000-000000000003'],['Title','A table for better questions (Demo)'],['Description','An intimate dinner shaped around thoughtful conversation rather than networking.'],['Status','Published'],['Starts At','2026-10-03T18:30:00-04:00'],['Ends At','2026-10-03T21:00:00-04:00'],['Timezone','America/New_York'],['Capacity','8'],['Location Label','Washington, DC']]],
    ['31000000-0000-4000-8000-000000000004',[['Event ID','31000000-0000-4000-8000-000000000004'],['Title','The autumn blind dinner (Demo)'],['Description','A small, confidential table for women navigating meaningful decisions.'],['Status','Published'],['Starts At','2026-11-07T18:30:00-05:00'],['Ends At','2026-11-07T21:00:00-05:00'],['Timezone','America/New_York'],['Capacity','10'],['Location Label','New York, NY']]]
  ];
  var added=0;
  var base=PropertiesService.getScriptProperties().getProperty('PORTAL_URL');
  if(!base||!/^https:\/\//.test(base))throw new Error('Configure the HTTPS portal origin in Script Properties first.');
  cnbPortalSetDefault('Portal Settings','community','Guidelines URL',base.replace(/\/$/,'')+'/terms');
  resources.forEach(function(item){if(cnbPortalAppendGroup('Library Resources',item[0],item[1]))added++;});
  boards.forEach(function(item){if(cnbPortalAppendGroup('Advisory Boards',item[0],item[1]))added++;});
  dinners.forEach(function(item){if(cnbPortalAppendGroup('Blind Dinner Events',item[0],item[1]))added++;});
  cnbPortalFormatWorkbook(true);ui.alert('Imported '+added+' staging editorial records and enabled discussion posting with the staging terms link. Review them, then use Preview changes before publishing.');
}
function cnbPortalAddTerm(){cnbPortalRows('Member Taxonomies',[['Term ID',Utilities.getUuid()],['Kind','expertise'],['Label','New term'],['Parent Term ID',''],['Active','TRUE'],['Display Order','1000']]);}

var CNB_PAGES=['home','library','directory','advisory-boards','community','dinners'];
var CNB_TYPES=['hero','text-image','cards','cta','existing','library-feed','event-feed','directory-preview','discussion-preview'];
function cnbPortalAddSection() {
  cnbPortalRows('Page Sections',[
    ['Section ID',Utilities.getUuid()],['Page','home'],['Section Type','text-image'],['Status','Draft'],['Display Order','50'],
    ['Eyebrow',''],['Title','New section'],['Body',''],['Image',''],['Image Asset ID',''],['Image Alt',''],['Image Position','right'],
    ['Focal X',''],['Focal Y',''],['Theme','light'],['CTA Label',''],['CTA Link',''],['Data Source',''],
    ['Card 1 Title',''],['Card 1 Body',''],['Card 1 Label',''],['Card 1 Link',''],
    ['Card 2 Title',''],['Card 2 Body',''],['Card 2 Label',''],['Card 2 Link',''],
    ['Card 3 Title',''],['Card 3 Body',''],['Card 3 Label',''],['Card 3 Link',''],
    ['Card 4 Title',''],['Card 4 Body',''],['Card 4 Label',''],['Card 4 Link','']
  ]);
  cnbPortalSectionDropdowns();
}
function cnbPortalSelection() {
  var sheet=SpreadsheetApp.getActiveSheet();
  if(sheet.getName()!=='Page Sections' || sheet.getActiveRange().getRow()<2) throw new Error('Select any row belonging to a section in Page Sections first.');
  var rows=sheet.getDataRange().getDisplayValues(),key=rows[sheet.getActiveRange().getRow()-1][0];
  return {sheet:sheet, rows:rows, selected:rows.map(function(row,i){return {row:row,index:i+1};}).filter(function(x){return x.row[0]===key;})};
}
function cnbPortalDuplicateSection() {
  var group=cnbPortalSelection(),id=Utilities.getUuid(),key='section-'+id;
  var rows=group.selected.map(function(x){var row=x.row.slice();row[0]=key;if(row[1]==='Section ID')row[2]=id;if(row[1]==='Status')row[2]='Draft';return row;});
  var start=group.sheet.getLastRow()+1;group.sheet.getRange(start,1,rows.length,5).setNumberFormat('@').setValues(rows);
  group.sheet.setActiveRange(group.sheet.getRange(start,3));cnbPortalSectionDropdowns();
}
function cnbPortalSetSelected(field,value) {
  var group=cnbPortalSelection(),match=group.selected.filter(function(x){return x.row[1]===field;})[0];
  if(!match) throw new Error('This section is missing '+field);group.sheet.getRange(match.index,3).setValue(value);
}
function cnbPortalOrderSection() {
  var ui=SpreadsheetApp.getUi(),answer=ui.prompt('Section order','Enter a number from 0 to 10000. Smaller numbers appear first on this page.',ui.ButtonSet.OK_CANCEL);
  if(answer.getSelectedButton()!==ui.Button.OK)return;
  var value=answer.getResponseText().trim();if(!/^\d+$/.test(value)||Number(value)>10000)throw new Error('Use a whole number from 0 to 10000.');
  cnbPortalSetSelected('Display Order',value);
}
function cnbPortalArchiveSection(){cnbPortalSetSelected('Status','Archived');}
function cnbPortalSectionDropdowns() {
  var sheet=SpreadsheetApp.getActive().getSheetByName('Page Sections');if(!sheet)return;
  var choices={'Page':CNB_PAGES,'Section Type':CNB_TYPES,'Status':['Draft','Published','Archived'],'Theme':['light','lined','black'],'Image Position':['left','right','above','below'],'Data Source':['features','events','connections','content','board','dinner']};
  sheet.getDataRange().getDisplayValues().forEach(function(row,i){if(choices[row[1]])sheet.getRange(i+1,3).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(choices[row[1]],true).setAllowInvalid(false).build());});
}
function cnbPortalFormatWorkbook(silent) {
  var names=['member-home','Portal Settings','Library Resources','Member Taxonomies','Advisory Boards','Blind Dinner Events','Page Sections'];
  var palette=['#eef3f7','#f4eef8','#eef6ef','#fbf2e8','#f7ecec','#eef5f4','#f5f2e9','#edf0f8'];
  var book=SpreadsheetApp.getActive(),formatted=0;
  names.forEach(function(name){
    var sheet=book.getSheetByName(name);if(!sheet)return;
    var lastRow=Math.max(sheet.getLastRow(),1),lastColumn=5;
    if(sheet.getMaxColumns()<lastColumn)sheet.insertColumnsAfter(sheet.getMaxColumns(),lastColumn-sheet.getMaxColumns());
    var range=sheet.getRange(1,1,lastRow,lastColumn),values=range.getDisplayValues(),backgrounds=[];
    var colors={},nextColor=0;
    values.forEach(function(row,index){
      if(index===0){backgrounds.push(['#11100f','#11100f','#11100f','#11100f','#11100f']);return;}
      var key=row[0].trim();
      if(!key){backgrounds.push(['#ffffff','#ffffff','#ffffff','#ffffff','#ffffff']);return;}
      if(!colors[key]){colors[key]=palette[nextColor%palette.length];nextColor++;}
      backgrounds.push([colors[key],colors[key],colors[key],colors[key],colors[key]]);
    });
    range.setBackgrounds(backgrounds).setVerticalAlignment('top').setFontFamily('Arial').setFontSize(10);
    sheet.getRange(1,1,1,lastColumn).setFontWeight('bold').setFontColor('#ffffff').setHorizontalAlignment('left').setVerticalAlignment('middle');
    sheet.getRange(2,1,Math.max(lastRow-1,1),2).setFontWeight('bold');
    sheet.getRange(1,3,lastRow,3).setWrap(true);
    sheet.setFrozenRows(1);sheet.setFrozenColumns(2);sheet.setHiddenGridlines(false);
    sheet.setColumnWidth(1,220);sheet.setColumnWidth(2,190);sheet.setColumnWidth(3,620);sheet.setColumnWidth(4,280);sheet.setColumnWidth(5,320);
    sheet.setRowHeight(1,32);if(lastRow>1)sheet.setRowHeights(2,lastRow-1,28);
    var filter=sheet.getFilter();if(filter)filter.remove();range.createFilter();
    var seen={};values.slice(1).forEach(function(row,index){
      var key=row[0].trim();if(!key||seen[key])return;seen[key]=true;
      sheet.getRange(index+2,1,1,lastColumn).setBorder(true,null,null,null,null,null,'#b8afa6',SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    });
    formatted++;
  });
  cnbPortalSectionDropdowns();
  SpreadsheetApp.flush();
  if(!silent)SpreadsheetApp.getUi().alert('Formatted '+formatted+' portal tabs. Content values were not changed.');
}
function cnbPortalOpen(path) {
  var base=PropertiesService.getScriptProperties().getProperty('PORTAL_URL');
  if(!base || !/^https:\/\/[a-z0-9.-]+(?::\d+)?\/?$/i.test(base)) throw new Error('Configure the HTTPS portal origin in Script Properties first.');
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput('<p><a target="_blank" rel="noopener" href="'+base.replace(/\/$/,'')+path+'">Open portal</a></p><p>Sign in as an administrator. Preview does not publish.</p>'),'C+B Portal');
}
function cnbPortalMediaLibrary(){cnbPortalOpen('/admin/media');}
function cnbPortalVisualPreview(){
  var group=cnbPortalSelection(),page=group.selected.filter(function(x){return x.row[1]==='Page';})[0];
  if(!page || CNB_PAGES.indexOf(page.row[2])<0)throw new Error('Choose a valid Page first.');
  cnbPortalOpen('/'+(page.row[2]==='home'?'':page.row[2])+'?cms_preview=1');
}
function cnbPortalImportDialog() {
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput('<p>Select the developer-provided portal starter ZIP. Existing populated tabs will never be overwritten.</p><input id="file" type="file" accept=".zip"><button onclick="upload()">Import</button><p id="status"></p><script>function upload(){var f=document.getElementById("file").files[0];if(!f)return;var r=new FileReader();r.onload=function(){document.getElementById("status").textContent="Importing...";google.script.run.withSuccessHandler(function(s){document.getElementById("status").textContent=s;}).withFailureHandler(function(e){document.getElementById("status").textContent=e.message;}).cnbPortalImportZip(r.result.split(",")[1]);};r.readAsDataURL(f);}</script>').setWidth(480).setHeight(220),'Import private portal workbook');
}
function cnbPortalImportZip(encoded) {
  var names=['member-home','Portal Settings','Library Resources','Member Taxonomies','Advisory Boards','Blind Dinner Events','Page Sections'];
  var book=SpreadsheetApp.getActive(),blobs=Utilities.unzip(Utilities.newBlob(Utilities.base64Decode(encoded),'application/zip','starter.zip'));
  var parsed={};blobs.forEach(function(blob){var name=blob.getName().split('/').pop().replace(/\.csv$/,'');if(names.indexOf(name)>=0)parsed[name]=Utilities.parseCsv(blob.getDataAsString('UTF-8'));});
  names.forEach(function(name){var sheet=book.getSheetByName(name);if(sheet && sheet.getLastRow()>1)throw new Error('Refusing to overwrite populated tab '+name);if(!parsed[name]||parsed[name][0].join(',')!=='section,field,value,link,notes')throw new Error('Missing or invalid template '+name);});
  names.forEach(function(name){var sheet=book.getSheetByName(name)||book.insertSheet(name),rows=parsed[name];sheet.getRange(1,1,rows.length,5).setNumberFormat('@').setValues(rows);});
  cnbPortalFormatWorkbook(true);return 'Seven tabs imported and formatted. Keep this workbook private. Configure its service-account Viewer and publishing settings before previewing.';
}
