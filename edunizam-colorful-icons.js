/* EduNizam premium illustrated icon system — 2026-10-08.
 * Self-contained vector icons: no icon font, CDN, external image, or dependency.
 * Replaces visual symbols only. Original text, handlers, routes, role rules,
 * accessibility labels and underlying buttons are preserved. */
(()=>{
 'use strict';
 const NS='http://www.w3.org/2000/svg';
 const P={
   home:'<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>',
   up:'<path d="M12 20V4m-7 7 7-7 7 7"/>',
   users:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2z"/><path d="M17 5a3 3 0 0 1 0 6m1 3a5 5 0 0 1 3 5"/>',
   user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2z"/>',
   school:'<path d="M3 21V8l9-5 9 5v13M3 21h18M9 21v-6h6v6M7 10h.01M12 10h.01M17 10h.01"/>',
   upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
   attendance:'<path d="M8 3v4m8-4v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z"/><path d="m8 15 3 3 5-6"/>',
   chart:'<path d="M4 20V4M4 20h17M8 16v-4m5 4V8m5 8V5"/>',
   teacher:'<path d="M3 4h18v12H3zM8 20l4-4 4 4M7 8h6M7 11h9"/>',
   clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
   wallet:'<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 9V5a2 2 0 0 1 2-2h13M15 14h6"/>',
   cap:'<path d="m2 9 10-5 10 5-10 5L2 9Zm4 3v5c3 3 9 3 12 0v-5M22 10v6"/>',
   award:'<circle cx="12" cy="8" r="5"/><path d="m8 12-2 9 6-3 6 3-2-9"/>',
   sparkle:'<path d="m12 2 2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2Z"/>',
   door:'<path d="M5 21V4l14-2v19M5 21h16M15 12h.01"/>',
   id:'<rect x="2.5" y="4" width="19" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M5 17c.5-2 2-3 4-3s3.5 1 4 3m3-7h3m-3 4h3"/>',
   leave:'<path d="M8 3v3m8-3v3M4 8h16M5 5h14v16H5z"/><path d="m9 15 2 2 4-5"/>',
   results:'<path d="M4 20h16M6 17v-5h3v5m3 0V7h3v10m3 0V4h3v13"/>',
   book:'<path d="M12 6c-2-2-5-3-9-2v15c4-1 7 0 9 2 2-2 5-3 9-2V4c-4-1-7 0-9 2Z"/><path d="M12 6v15"/>',
   lesson:'<path d="M3 5h18v13H3zM9 22l3-4 3 4M7 9h9M7 13h6"/>',
   exam:'<path d="M7 3h9l4 4v14H7zM16 3v5h4M10 13h7M10 17h4"/><path d="m4 13 1.5 1.5L8 12"/>',
   pencil:'<path d="m4 20 4-1 12-12-3-3L5 16l-1 4ZM14 7l3 3M4 20h16"/>',
   diary:'<path d="M6 3h12a2 2 0 0 1 2 2v16H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM8 3v18M11 9h6m-6 4h6m-6 4h4"/>',
   schedule:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18M8 14h4m-4 3h8"/>',
   calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18M8 14h3m3 0h3m-9 4h3"/>',
   banknote:'<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M5 8h2m10 8h2"/>',
   receipt:'<path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3ZM9 8h6m-6 4h6m-6 4h4"/>',
   package:'<path d="m12 2 9 5-9 5-9-5 9-5Zm-9 5v10l9 5 9-5V7M12 12v10M8 4l9 5"/>',
   library:'<path d="M4 3h4v18H4zM10 6h4v15h-4zM16 4l4-1 3 17-4 1z"/>',
   bus:'<rect x="4" y="3" width="16" height="17" rx="3"/><path d="M4 11h16M8 20v2m8-2v2M8 15h.01M16 15h.01M8 7h8"/>',
   pin:'<path d="M12 22s8-8 8-14a8 8 0 0 0-16 0c0 6 8 14 8 14Z"/><circle cx="12" cy="8" r="2"/>',
   party:'<path d="m4 20 6-15 9 9L4 20ZM13 4h.01M18 3l1-1m3 8-2 2M17 19l1 2M9 13l5 5"/>',
   chat:'<path d="M4 4h16v13H9l-5 4V4Z"/><path d="M8 9h8M8 13h5"/>',
   megaphone:'<path d="m3 10 14-6v16L3 14zM17 7a5 5 0 0 1 0 10M6 15l2 6h4l-2-5"/>',
   support:'<circle cx="12" cy="12" r="9"/><path d="M8 9a4 4 0 1 1 7 2l-3 2v2M12 19h.01"/>',
   paper:'<path d="M6 2h9l5 5v15H6zM15 2v6h5M10 12h7m-7 4h7"/>',
   study:'<path d="M3 4h7a3 3 0 0 1 3 3v14H6a3 3 0 0 0-3 1V4Zm18 0h-5a3 3 0 0 0-3 3v14h5a3 3 0 0 1 3 1V4Z"/>',
   landmark:'<path d="m2 9 10-6 10 6M3 10h18M5 10v9m5-9v9m4-9v9m5-9v9M2 21h20"/>',
   target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
   compass:'<circle cx="12" cy="12" r="9"/><path d="m15 9-6 2 2 4 4-6Z"/>',
   route:'<circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 5h9a4 4 0 0 1 0 8H8a4 4 0 0 0 0 8h9"/>',
   laptop:'<rect x="4" y="4" width="16" height="12" rx="1"/><path d="M2 20h20l-2-4H4l-2 4Z"/>',
   gears:'<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2"/>',
   wrench:'<path d="M15 3a6 6 0 0 0-7 7L3 15a4 4 0 0 0 6 6l5-5a6 6 0 0 0 7-7l-4 4-4-4 4-4-2-2Z"/>',
   grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
   search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
   arrows:'<path d="m4 8 5-5m-5 5 5 5M4 8h16m0 8-5-5m5 5-5 5M20 16H4"/>',
   shield:'<path d="M12 2 21 6v6c0 5-4 8-9 10-5-2-9-5-9-10V6z"/><path d="m8 12 3 3 5-6"/>'
 };
 const views={
   dashboard:['home','blue'],students:['users','sky'],studentprofile:['user','violet'],
   classcenter:['school','teal'],bulkimport:['upload','amber'],attendance:['attendance','green'],
   attendanceanalytics:['chart','blue'],staffcenter:['teacher','violet'],stafftime:['clock','amber'],
   staffpayroll:['wallet','rose'],training:['cap','blue'],ourstudents:['award','amber'],
   behaviorcenter:['sparkle','violet'],gatecenter:['door','teal'],studentdocs:['id','sky'],
   leavecenter:['leave','green'],results:['results','blue'],schoolwork:['book','violet'],
   lessoncenter:['lesson','teal'],examcenter:['exam','rose'],paperbuilder:['pencil','amber'],
   dailydiary:['diary','sky'],schedulecenter:['schedule','violet'],calendarcenter:['calendar','teal'],
   fees:['banknote','green'],financecenter:['wallet','amber'],inventorycenter:['package','rose'],
   librarycenter:['library','violet'],transportcenter:['bus','sky'],noticeboard:['pin','rose'],
   functionscenter:['party','amber'],inboxcenter:['chat','sky'],parentcomplaints:['megaphone','rose'],
   helpdeskcenter:['support','teal'],pastpapers:['paper','blue'],practice:['pencil','rose'],
   study:['study','violet'],schoolassessments:['exam','green'],universities:['landmark','blue'],
   competitive:['award','amber'],ecosystem:['target','rose'],pathways:['route','sky'],
   vu:['laptop','violet'],admissions:['receipt','teal'],assistant:['sparkle','violet'],
   settings:['gears','blue'],troubleshoot:['wrench','amber'],help:['support','green']
 };
 const groupIcons={Core:['grid','sky'],'People & Campus':['users','teal'],
   Academics:['book','violet'],'Finance & Operations':['wallet','amber'],
   Communication:['chat','rose'],'Pakistan Learning':['cap','blue'],
   System:['gears','teal'],'Daily Work':['attendance','green'],
   Overview:['home','sky'],More:['grid','violet']};

 // Illustrated dual-tone SVG library: recognisable filled objects, vibrant accents,
 // and dark crisp outlines (rather than thin one-colour line glyphs).
 const iR=(x,y,w,h,rad,c)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+rad+'" class="ei-'+c+'"/>';
 const iC=(x,y,r,c)=>'<circle cx="'+x+'" cy="'+y+'" r="'+r+'" class="ei-'+c+'"/>';
 const iP=(d,c='ink')=>'<path d="'+d+'" class="ei-'+c+'"/>';
 const A={
   home:()=>iP('M2.8 10.8 12 3.2l9.2 7.6-1.8 2.1-1.4-1.1V21H6v-9.2l-1.4 1.1Z','primary')+iR(10,14,4,7,1.1,'secondary')+iP('M2.5 11.1 12 3l9.5 8.1','ink')+iC(17,7,1.2,'yellow'),
   users:()=>iC(9,8,3.8,'primary')+iC(18,9,2.8,'secondary')+iP('M2.5 20v-2.1c0-3.3 2.9-5.8 6.5-5.8 3.7 0 6.6 2.5 6.6 5.8V20Z','light')+iP('M16.7 14c3.1-.1 4.8 2.2 4.8 4.6V20','ink')+iC(10,6.7,.9,'shine'),
   user:()=>iC(12,7.8,4,'secondary')+iP('M4 20c0-5 3.4-7.8 8-7.8s8 2.8 8 7.8v1H4Z','primary')+iC(13.3,6.5,1,'shine'),
   attendance:()=>iR(3,4.2,18,17,2.5,'light')+iP('M3 9.7h18V6.8a2.6 2.6 0 0 0-2.6-2.6H5.6A2.6 2.6 0 0 0 3 6.8Z','secondary')+iP('M7 2.5v4.4m10-4.4v4.4','ink')+iP('m7.7 15 2.7 2.7 5.6-6','check'),
   banknote:()=>iR(2.4,5.7,19.2,13.1,2.4,'primary')+iR(5,8,14,8.6,1.1,'light')+iC(12,12.3,3,'secondary')+iP('M11 10.7h2m-2 3h2m-1-4v5.3','ink')+iC(5.5,11.9,.8,'shine')+iC(18.6,12.3,.8,'shine'),
   clock:()=>iC(12,12,9.4,'light')+iP('M12 5.6v6.6l4.3 2.7','accentline')+iC(12,12,1.5,'secondary')+iP('M8 4.5 5.8 2.7M16 4.5l2.2-1.8','ink'),
   grid:()=>iR(2.3,2.3,8.7,8.7,2.2,'primary')+iR(13,2.3,8.7,8.7,2.2,'secondary')+iR(2.3,13,8.7,8.7,2.2,'yellow')+iR(13,13,8.7,8.7,2.2,'light'),
   chat:()=>iP('M4 3.5h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H10l-6 3V5.5a2 2 0 0 1 2-2Z','primary')+iR(7,7.9,10,1.8,.9,'shine')+iR(7,11.6,7,1.8,.9,'shine')+iC(18,14,1.4,'yellow'),
   school:()=>iP('M3 20V8l9-5 9 5v12Z','light')+iP('M3 8l9-5 9 5','secondary')+iR(9.2,13,5.6,7,1,'primary')+iR(5.1,10,2.4,2.4,.4,'yellow')+iR(16.5,10,2.4,2.4,.4,'yellow')+iP('M2 21h20','ink'),
   cap:()=>iP('M1.5 9 12 4l10.5 5L12 14Z','primary')+iP('M5.7 12v5.1c3.7 3.1 9.1 3.1 12.6 0V12','light')+iP('M21 10v6.5','ink')+iC(21,18.4,1.7,'yellow'),
   book:()=>iP('M12 6c-2.2-2-5.7-2.8-9-2.1v14.9c3.6-.7 6.7.1 9 2.2Z','primary')+iP('M12 6c2.3-2 5.4-2.8 9-2.1v14.9c-3.5-.7-6.8.1-9 2.2Z','light')+iP('M7 9h2m-2 3h2m6-3h2m-2 3h2','ink'),
   pencil:()=>iP('m4 16 12.7-12.7 4 4L8 20l-5 1Z','primary')+iP('m4 16 4 4-5 1Z','secondary')+iP('M14.7 5.3l4 4','ink')+iC(19.3,4.8,1.3,'yellow'),
   wallet:()=>iR(2.3,5.1,19.4,15.6,3,'primary')+iP('M3 8V5.6a2 2 0 0 1 2-2h13','ink')+iR(13.6,11,9,6,2,'secondary')+iC(17.2,14,1.1,'shine'),
   teacher:()=>iR(2.8,4,18.4,13.7,2,'primary')+iR(5.4,6.5,13.2,8.6,1,'light')+iP('M7 10h6m-6 3h4M9 21l3-3.3 3 3.3','ink')+iC(17,11,1.6,'secondary'),
   award:()=>iC(12,8.1,5.3,'yellow')+iC(12,8.1,2.5,'primary')+iP('m8.4 12.3-2.3 9 5.9-3.3 5.9 3.3-2.3-9','secondary')+iP('m10.5 8 1.2 1.3 2.1-2.4','shine-line'),
   sparkle:()=>iP('M12 1.5 15 9l7.5 3-7.5 3-3 7.5L9 15l-7.5-3L9 9Z','primary')+iP('m18 1.5 1.2 2.7 2.7 1.2-2.7 1.2L18 9l-1.2-2.4-2.7-1.2 2.7-1.2Z','yellow'),
   paper:()=>iP('M5 2.5h9.6L20 8v13.4H5Z','light')+iP('M14.6 2.5V8H20','secondary')+iP('M8 12h8M8 15.2h8M8 18.3h5','ink')+iC(6.7,6.4,1.2,'yellow'),
   exam:()=>iP('M5 2.5h9.5L20 8v13.5H5Z','light')+iP('M14.5 2.5V8H20','secondary')+iP('m8.1 14 2.4 2.4 5-5.3','check')+iP('M8 19h8','ink'),
   calendar:()=>iR(2.8,4.7,18.4,16,2.4,'light')+iP('M2.8 10.1h18.4V7.2c0-1.5-1-2.5-2.5-2.5H5.3c-1.5 0-2.5 1-2.5 2.5Z','secondary')+iP('M7.5 2.7v4.4m9-4.4v4.4','ink')+iR(6.4,13,4.1,4.1,.9,'primary')+iR(13,13,4.1,4.1,.9,'yellow'),
   schedule:()=>iR(3,4.7,18,16,2,'light')+iP('M3 10h18V7a2.3 2.3 0 0 0-2.3-2.3H5.3A2.3 2.3 0 0 0 3 7Z','primary')+iP('M8 2.7v4m8-4v4M7.6 14h3m-3 4h8','ink')+iC(17,14.6,1.6,'yellow'),
   chart:()=>iP('M3 3v18h19','ink')+iR(6,13.5,3.6,5.6,.7,'yellow')+iR(11,9.5,3.6,9.6,.7,'primary')+iR(16.2,5.4,3.6,13.7,.7,'secondary')+iP('m6 8 4-3 3 2 6-4','accentline'),
   results:()=>iR(3.8,13,4.4,7,1,'yellow')+iR(10,8.5,4.4,11.5,1,'primary')+iR(16.2,4,4.4,16,1,'secondary')+iP('M2.8 21h19','ink')+iC(18.4,3,1.3,'shine'),
   id:()=>iR(2,4.3,20,15.3,2.3,'light')+iR(4.2,6.5,8.2,10.9,1.7,'primary')+iC(8.2,9.9,2,'secondary')+iP('M5.6 15.3c.3-2.1 4.8-2.1 5.2 0M15 9h4M15 13h4M15 16h2.9','ink'),
   library:()=>iR(3,4,5.1,17,1,'primary')+iR(9.1,6,5.1,15,1,'secondary')+iP('m16.5 4 4.2-.8 2.4 17-4.2.8Z','yellow')+iP('M4.5 8.4h2m3.6 2h2m5.9-.4 2-.3','ink'),
   bus:()=>iR(3,3.6,18,16.6,3,'primary')+iR(5.2,6.7,13.6,6.2,1,'light')+iR(6.1,15.3,3.6,1.9,.7,'yellow')+iR(14.4,15.3,3.6,1.9,.7,'yellow')+iP('M7 20v2m10-2v2','ink'),
   support:()=>iC(12,12,9.7,'secondary')+iP('M8.3 9a4 4 0 1 1 6.7 3l-3 2v1.5','shine-line')+iC(12,19,1.25,'yellow'),
   target:()=>iC(12,12,9.6,'light')+iC(12,12,6.3,'primary')+iC(12,12,3.2,'secondary')+iC(12,12,1.1,'shine'),
   receipt:()=>iR(8.5,6.3,7.2,2.3,.7,'primary')+iP('M5 2.7h14v18.5l-3.5-2-3.5 2-3.5-2-3.5 2Z','light')+iP('M9 7.5h6m-6 3.8h6m-6 3.9h3','ink')+iC(17,16,2,'yellow'),
   laptop:()=>iR(4,3.8,16,12.6,1.5,'primary')+iR(6,5.9,12,8.4,.5,'light')+iP('M2 20h20l-2-3.6H4Z','secondary')+iP('M10 18.5h4','ink'),
   pin:()=>iP('M12 22s8.5-8.4 8.5-14a8.5 8.5 0 0 0-17 0c0 5.6 8.5 14 8.5 14Z','primary')+iC(12,8.6,3.1,'yellow'),
   upload:()=>iR(8,5,8,9,2,'primary')+iR(4,15,16,5,1,'light')+iP('M4 15v5h16v-5','ink')+iP('M12 17V3m-5 5 5-5 5 5','accentline'),
   search:()=>iC(10.5,10.5,4.6,'secondary')+iC(10.5,10.5,6.4,'light')+iP('m15.3 15.3 5.4 5.4','accentline')+iC(10.5,10.5,2.4,'yellow'),
   up:()=>iC(12,12,9.4,'primary')+iP('M12 20V3M5.7 9.5 12 3l6.3 6.5','shine-line')+iC(12,14.5,1.2,'yellow'),
   shield:()=>iP('M12 2.2 21 6v6c0 5.6-3.6 8.3-9 10-5.4-1.7-9-4.4-9-10V6Z','primary')+iP('m7.7 11.9 3.1 3.2 5.7-6','shine-line'),
   leave:()=>iR(3.3,4.2,17.4,17,2,'light')+iP('M3.3 9.6h17.4V6.5a2.3 2.3 0 0 0-2.3-2.3H5.6a2.3 2.3 0 0 0-2.3 2.3Z','secondary')+iP('m7.6 15.2 2.6 2.6 5.9-6.3','check'),
   party:()=>iP('M4 20 10 4l10 10Z','primary')+iP('m7 13 5 5m1.5-12 1.4-2m3.4 4 2.6-.5M18 18l2 2','ink')+iC(19,4.2,1.5,'yellow')+iC(21,11,1,'secondary'),
   door:()=>iP('M5 21V4L19 2v19Z','light')+iP('M5 4 19 2v19H5Z','primary')+iC(15,12,1.2,'yellow'),
   diary:()=>iR(4,2.3,16.4,19.3,2,'light')+iR(4,2.3,4.5,19.3,1,'primary')+iP('M11 8h6m-6 4h6m-6 4h4','ink'),
   gears:()=>iC(12,12,8.7,'secondary')+iC(12,12,4.8,'light')+iC(12,12,1.8,'primary')+iP('M12 1v3m0 16v3M1 12h3m16 0h3M4.4 4.4l2.2 2.2m10.8 10.8 2.2 2.2m0-15.2-2.2 2.2M6.6 17.4l-2.2 2.2','ink'),

   lesson:()=>iR(2.5,4,19,13.7,2,'primary')+iR(4.7,6.1,14.6,9.4,1,'light')+iP('M9 21l3-3.3 3 3.3M7.5 9h9m-9 3h6','ink')+iC(18,12,1.7,'secondary'),
   package:()=>iP('M12 2 21 7.1v10L12 22l-9-4.9v-10Z','primary')+iP('m3 7.1 9 5.3 9-5.3','secondary')+iP('M12 12.4V22M7.3 4.5l9.4 5.2','ink')+iP('m14.3 3.3 4.2 2.4-9 5.1-4.2-2.4','light'),
   megaphone:()=>iP('M3 10h4.6L19 4.5v15L7.6 14H3Z','primary')+iP('M6.2 14.4 8 21h3l-1.5-5.8','secondary')+iP('M19.2 8.3a4.4 4.4 0 0 1 0 7.4','ink')+iC(20.9,5.5,1.4,'yellow'),
   study:()=>iP('M12 6C10.1 4 6.3 3 3 4.2V20c3.9-1 6.9-.2 9 2Z','primary')+iP('M12 6c2-2 5.6-3 9-1.8V20c-4-1-7-.2-9 2Z','secondary')+iP('M12 6v16M5.7 8h3.6m-3.6 3h3.6m5.3-3h3.4m-3.4 3h3.4','ink'),
   landmark:()=>iP('m2 8.2 10-5.6 10 5.6Z','primary')+iP('M4 9.5h16M2 21h20','ink')+iR(4.7,10,3,9.4,.6,'light')+iR(10.5,10,3,9.4,.6,'secondary')+iR(16.3,10,3,9.4,.6,'light'),
   route:()=>iC(5.3,5,2.7,'primary')+iC(18.8,19,2.7,'secondary')+iP('M8.1 5H16a4.2 4.2 0 0 1 0 8.4H9a4.2 4.2 0 0 0 0 8.4h6.6','accentline'),
   wrench:()=>iP('M19 3.3a6.2 6.2 0 0 0-7.7 7.5l-7 6.4a3.2 3.2 0 0 0 4.5 4.5l6.5-7a6.2 6.2 0 0 0 7.4-7.7l-4.4 4.2-4.2-4.2Z','primary')+iC(6.4,18.1,1.1,'yellow'),
   arrows:()=>iC(5.6,8.3,2.8,'primary')+iC(18.4,16,2.8,'secondary')+iP('M4 8h16m0 0-5-5m5 5-5 5M20 16H4m0 0 5-5m-5 5 5 5','accentline'),
   compass:()=>iC(12,12,9.8,'light')+iP('m15.7 8.3-2.1 5.3-5.3 2.1 2.1-5.3Z','primary'),
   check:()=>iC(12,12,9.7,'primary')+iP('m6.8 12 3.4 3.5 6.8-7','shine-line')
 };
 /* v7: Each semantic illustration has its own paint definitions. Tone variables
  * are inherited by SVG gradient stops; distinct local IDs avoid collisions
  * between menu, dock, dashboard, guest, and login instances. */
 let iconSequence=0;

 /* Premium illustrated icon family (v9). Self-hosted SVG objects instead of
    monochrome 24px glyphs. All shapes remain aria-hidden and pointer-safe. */
 const shape=(d,c='main',stroke='#2f5471',sw=1.45)=>
  '<path d="'+d+'" fill="url(#G-'+c+')" stroke="'+stroke+'" stroke-width="'+sw+'" stroke-linejoin="round" stroke-linecap="round"/>';
 const rect=(x,y,w,h,r,c='main',stroke='#2f5471',sw=1.2)=>
  '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+r+'" fill="url(#G-'+c+')" stroke="'+stroke+'" stroke-width="'+sw+'"/>';
 const circ=(x,y,r,c='main',stroke='#2f5471',sw=1.15)=>
  '<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="url(#G-'+c+')" stroke="'+stroke+'" stroke-width="'+sw+'"/>';
 const wire=(d,color='#365775',w=2)=>
  '<path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="'+w+'" stroke-linejoin="round" stroke-linecap="round"/>';
 const glint=(d)=>'<path d="'+d+'" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".85"/>';
 const scenes={
  school:()=>shape('M7 25 31 9l26 16-2 4-24-13L9 29Z','gold')+
    rect(11,27,42,27,3,'paper')+rect(15,29,34,6,1.5,'blue')+
    rect(18,38,8,9,1,'sky')+rect(37,38,8,9,1,'sky')+
    shape('M28 54V41h8v13Z','purple')+
    wire('M9 54h46M31 15v-6h12v8','#29577b',1.8)+
    shape('M32 9h12l-3 4 3 3H32Z','green','#19866e',.8)+
    glint('M16 30h27'),
  study:()=>shape('M7 20q12-6 25 2v30Q20 45 8 50Z','green')+
    shape('M32 22q12-8 24-3v30q-13-4-24 3Z','gold')+
    shape('M11 16q13-3 21 5v26q-10-7-21-4Z','paper')+
    shape('M32 21q11-9 21-6v28q-11-3-21 4Z','paper')+
    wire('M32 21v28M16 24q6-1 11 3m-11 5q6 0 11 3m10-9q5-3 11-3m-11 9q5-3 11-3','#3d899d',1.55)+
    shape('M41 35 51 9l5 2-10 27-8 5Z','gold','#aa6a23',1.1)+
    shape('m51 9 2-6 3 8Z','rose','#9a5a3a',.9),
  home:()=>rect(7,11,50,43,7,'purple')+
    rect(12,17,40,31,3,'paper')+shape('M12 20h40v9H12Z','blue')+
    circ(17,24,1.7,'gold','#fff',.5)+circ(23,24,1.7,'rose','#fff',.5)+
    rect(18,36,7,8,1,'green')+rect(29,32,7,12,1,'gold')+
    rect(40,34,7,10,1,'sky')+glint('M13 14h33'),
  laptop:()=>rect(10,11,44,34,3.5,'blue')+
    rect(14,15,36,26,1.5,'sky')+shape('M6 46h52l4 7-5 4H7l-5-4Z','silver')+
    shape('M23 48h18l3 4H20Z','paper','#6e8fa3',.8)+
    wire('m20 33 8-9 7 4 9-10','#fff',2.8)+glint('M15 16h29'),
  cap:()=>shape('M4 25 31 11l29 14-29 15Z','purple')+
    shape('M14 34v12q17 14 34 0V34L31 44Z','blue')+
    wire('M57 26v21','#9d692c',2.7)+circ(57,49,3.5,'gold','#b17c23',.9)+
    glint('m16 23 15-8 14 8'),
  attendance:()=>rect(9,8,46,47,6,'blue')+
    rect(12,21,40,31,3,'paper')+shape('M9 14q0-6 6-6h34q6 0 6 6v11H9Z','purple')+
    wire('M21 6v11m22-11v11','#42587d',3.1)+
    circ(32,37,11,'green','#1d8469',1.1)+wire('m26 37 4.5 4.5 8-9','#fff',3.6)+
    glint('M14 15h33'),
  calendar:()=>rect(9,9,46,45,6,'blue')+
    rect(12,22,40,29,3,'paper')+shape('M9 16q0-7 7-7h32q7 0 7 7v10H9Z','purple')+
    wire('M21 7v11M43 7v11','#38597c',3)+
    rect(18,32,10,9,2,'green')+rect(35,32,10,9,2,'gold')+
    wire('m34 46 4 3 7-9','#158169',2.9),
  teacher:()=>rect(6,13,52,36,4,'green')+
    rect(10,17,44,28,2,'dark')+
    wire('M21 53h22M32 49v4','#a16d35',2.5)+
    wire('M17 26h18M17 32h13','#dffdf4',2.3)+
    circ(44,27,4,'gold','#dfbf59',.6)+
    shape('M41 33 32 44l-3-3 9-11Z','rose')+glint('M11 17h35'),
  users:()=>circ(24,23,9,'gold')+circ(44,24,7,'purple')+
    shape('M9 50q1-16 16-16t16 16v4H9Z','blue')+
    shape('M37 40q13-11 21 6v7H44v-4q0-6-7-9Z','green')+
    glint('M20 19q3-3 7-1'),
  results:()=>shape('M7 13q0-5 5-5h40q5 0 5 5v40H7Z','paper')+
    rect(14,33,9,15,2,'sky')+rect(28,25,9,23,2,'green')+
    rect(42,17,9,31,2,'gold')+
    wire('M12 50h43','#41677d',2)+glint('M10 13h36'),
  banknote:()=>rect(6,17,52,33,6,'green')+
    rect(10,21,44,25,4,'paper')+circ(32,34,9,'gold','#c38c2e',1)+
    wire('M30 28h5m-5 6h5m-2-7v14','#9c752a',1.8)+
    circ(15,34,2,'blue','#fff',.4)+circ(49,34,2,'blue','#fff',.4)+glint('M11 22h33'),
  wallet:()=>rect(7,15,50,36,7,'purple')+
    shape('M8 21V13q0-4 5-4h35v8Z','gold')+
    rect(37,27,23,17,5,'blue')+circ(47,35,3.2,'gold','#d7a53d',.6)+
    glint('M13 18h35'),
  paper:()=>shape('M12 7h29l11 11v38H12Z','paper')+
    shape('M41 7v12h11Z','blue')+wire('M20 29h25M20 36h25M20 43h17','#5796a7',2)+
    rect(6,26,13,18,3,'gold','#a97c31',1.1)+glint('M15 11h22'),
  exam:()=>shape('M13 7h28l10 10v39H13Z','paper')+
    shape('M41 7v11h10Z','purple')+
    circ(31,36,12,'green','#168669',1.1)+wire('m25 37 5 5 9-11','#fff',3.3)+
    glint('M16 11h22'),
  pencil:()=>shape('M10 42 45 7q3-3 6 0l7 7q3 3 0 6L23 55 7 58Z','gold')+
    shape('m10 42 13 13-16 3Z','paper')+
    shape('m45 7 13 13-7 7-13-13Z','purple')+
    wire('m14 42 31-31','#fff',2.3)+circ(48,8,2,'rose','#fff',.5),
  diary:()=>rect(12,7,43,49,4,'purple')+
    rect(16,9,36,43,2,'paper')+shape('M12 7h10v49H12Z','blue')+
    wire('M28 23h17M28 31h17M28 39h12','#65a0b5',2)+
    rect(37,6,9,17,2,'gold')+glint('M18 12h29'),
  chat:()=>shape('M8 13q0-5 5-5h36q7 0 7 7v25q0 6-6 6H24l-13 10V45q-3-2-3-5Z','blue')+
    rect(15,18,34,20,5,'paper','#5b849c',.7)+circ(22,28,3,'green')+
    circ(32,28,3,'gold')+circ(42,28,3,'rose')+glint('M12 12h31'),
  library:()=>rect(9,12,11,40,3,'blue')+rect(22,8,12,44,3,'green')+
    rect(36,14,11,38,3,'gold')+shape('M49 11h8v41h-8Z','purple')+
    wire('M12 44h5m8-26h6m8 16h5m7 12h4','#fff',2)+glint('M12 14v16'),
  grid:()=>rect(8,8,21,21,5,'blue')+rect(35,8,21,21,5,'green')+
    rect(8,35,21,21,5,'gold')+rect(35,35,21,21,5,'purple')+
    glint('M12 12h12M39 12h12M12 39h12'),
  award:()=>circ(31,26,17,'gold','#a86e22',1.3)+circ(31,26,10,'paper','#cf9031',1)+
    shape('m16 39-5 18 20-8 20 8-5-18Z','purple')+
    wire('m26 26 4 4 7-9','#cb9b31',2.8)+glint('M23 14q7-4 14 0'),
  bus:()=>rect(8,11,48,42,8,'gold')+rect(13,17,38,19,3,'sky')+
    wire('M32 17v19','#55798b',1.6)+rect(16,41,10,5,2,'paper')+
    rect(39,41,10,5,2,'paper')+circ(20,53,5,'dark','#344b69',.8)+
    circ(44,53,5,'dark','#344b69',.8)+glint('M13 13h35'),
  receipt:()=>shape('M15 7h34v49l-7-4-6 4-5-4-7 4-9-4Z','paper')+
    rect(21,14,22,8,2,'green')+wire('M22 30h20M22 36h20M22 42h12','#6498aa',2)+
    circ(45,45,7,'gold','#bd8d3c',1)+glint('M19 10h26'),
  support:()=>circ(32,32,24,'blue','#285c7e',1)+circ(32,32,17,'paper','#528d9d',1)+
    circ(32,32,9,'green','#1a866c',.8)+
    shape('M19 15 13 9 8 14l6 7Z','gold')+
    shape('M45 15 51 9l5 5-6 7Z','gold')+
    glint('M19 26q3-8 11-9'),
  sparkle:()=>shape('M31 3 39 24 61 32 40 39 32 61 24 40 3 32 24 24Z','gold')+
    circ(49,14,5,'purple','#7043a9',.75)+
    glint('m28 13 4 10 4-10'),
  upload:()=>rect(8,39,48,16,4,'paper')+
    shape('M32 6 18 25h9v19h10V25h9Z','blue')+
    circ(49,47,3,'green','#fff',.6)+glint('M30 14v24'),
  search:()=>circ(26,26,16,'sky','#256d9a',1.9)+
    circ(26,26,10,'paper','#91bcd1',1.1)+
    shape('M38 39 44 34l16 17q3 4-1 8-4 3-8-1Z','gold')+
    glint('M18 23q3-6 9-7'),
  settings:()=>circ(32,32,23,'purple')+circ(32,32,13,'paper')+circ(32,32,6,'blue')+
    wire('M32 6v8M32 50v8M6 32h8m36 0h8M14 14l6 6m24 24 6 6m0-36-6 6M20 44l-6 6','#fff',2.5),
  gears:()=>circ(32,32,23,'purple')+circ(32,32,13,'paper')+circ(32,32,6,'blue')+
    wire('M32 6v8M32 50v8M6 32h8m36 0h8M14 14l6 6m24 24 6 6m0-36-6 6M20 44l-6 6','#fff',2.5),
  clock:()=>circ(32,32,25,'sky')+circ(32,32,20,'paper')+
    wire('M32 19v14l10 7','#2d698f',3.4)+circ(32,32,3,'gold','#be8e38',.7)+glint('M18 15q10-7 20-3')
 };
 const premiumIllustratedSvg=(key)=>{
   if(!Object.prototype.hasOwnProperty.call(scenes,key))return null;
   const seq=++iconSequence;
   const prefix='en3d-'+seq+'-';
   const raw=scenes[key]().replace(/url\(#G-([a-z]+)\)/g,(_,color)=>'url(#'+prefix+color+')')
    .replace(/fill="url\(#([a-zA-Z0-9-]+)\)"/g,(_,id)=>'style="fill:url(#'+id+')!important"');
   const gradients=[
    ['blue','#d8f5ff','#60b7ff','#335ad1'],
    ['sky','#eafaff','#87dbfb','#238fdb'],
    ['green','#eafff5','#55e5bb','#069473'],
    ['purple','#faf2ff','#bc96f6','#7650ce'],
    ['gold','#fff9dc','#ffd16b','#e7a12c'],
    ['rose','#fff1f4','#fb98b3','#ce5888'],
    ['paper','#fff','#f1f8ff','#bad4e7'],
    ['silver','#f7fbff','#cad9e6','#829bb1'],
    ['dark','#7996ac','#325879','#243d5f']
   ].map(([name,light,mid,deep])=>
     '<linearGradient id="'+prefix+name+'" x1=".03" y1=".01" x2=".94" y2=".95">'+
     '<stop offset="0" stop-color="'+light+'"/><stop offset=".49" stop-color="'+mid+'"/>'+
     '<stop offset="1" stop-color="'+deep+'"/></linearGradient>').join('');
   return '<svg class="edu-vector-icon edu-illustrated-icon edu-icon-premium-3d" viewBox="0 0 64 64" xmlns="'+NS+
     '" aria-hidden="true" focusable="false"><defs>'+gradients+'</defs>'+
     '<ellipse cx="32" cy="59" rx="24" ry="3.4" fill="#22435c" opacity=".17"/>'+
     raw+'</svg>';
 };

 const svg=key=>{
   const premium=premiumIllustratedSvg(key);
   if(premium)return premium;
   const art=A[key]?A[key]():'<g class="ei-fallback">'+(P[key]||P.grid)+'</g>'+iC(18.9,5.1,1.6,'yellow');
   const uid='enicon-'+(++iconSequence);
   const grad=(suffix,top,mid,base,deep)=>
     '<linearGradient id="'+uid+'-'+suffix+'" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">'+
     '<stop offset="0" style="stop-color:'+top+'"/>'+
     '<stop offset=".28" style="stop-color:'+mid+'"/>'+
     '<stop offset=".67" style="stop-color:'+base+'"/>'+
     '<stop offset="1" style="stop-color:'+deep+'"/></linearGradient>';
   const v=(name)=>'var(--'+name+')';
   const mix=(color,pct,withColor)=>'color-mix(in srgb,'+v(color)+' '+pct+'%,'+withColor+')';
   const defs='<defs>'+
     grad('main','#fff',mix('ei-primary',69,'white'),v('ei-primary'),mix('ei-primary',72,v('ei-ink')))+
     grad('accent','#fff7e3',mix('ei-second',78,'white'),v('ei-second'),mix('ei-second',76,v('ei-ink')))+
     grad('paper','#fff',v('ei-light'),mix('ei-bright',58,v('ei-light')),mix('ei-bright',70,v('ei-ink')))+
     grad('gold','#fff9c2','#ffe376','#ffcd48','#e7a729')+

     '</defs>';
   const enriched=art.replace(/class="ei-(primary|secondary|light|yellow)"/g,(_,kind)=>{
     const suffix={primary:'main',secondary:'accent',light:'paper',yellow:'gold'}[kind];
     return 'class="ei-'+kind+'" style="fill:url(#'+uid+'-'+suffix+')!important"';
   });
   return '<svg class="edu-vector-icon edu-illustrated-icon" viewBox="0 0 24 24" fill="none" xmlns="'+NS+'" aria-hidden="true" focusable="false">'+defs+
     '<circle cx="12" cy="12" r="10.85" class="ei-disc"/>'+
     '<g>'+enriched+'</g>'+
     '<path d="M4 6.6c1.25-2.4 3.15-3.65 5.8-4.3" class="ei-glass-arc"/>'+
     '<circle cx="6.3" cy="5.1" r=".74" class="ei-glimmer"/></svg>';
 };


 /* Actual 192px rendered soft clay art. SVG remains as a dependable fallback. */
 const clayMarkup=key=>svg(key)+
  '<img class="edu-clay-raster" src="assets/icons/clay-'+encodeURIComponent(key)+
  '.webp" alt="" role="presentation" aria-hidden="true" draggable="false" decoding="async" loading="lazy">';
 function syncClayRenders(){
  document.querySelectorAll('img.edu-clay-raster:not([data-clay-bound])').forEach(img=>{
   img.dataset.clayBound='1';
   const onLoad=()=>{if(img.naturalWidth>0)img.classList.add('edu-clay-ready')};
   if(img.complete)onLoad();
   img.addEventListener('load',onLoad,{once:true});
  });
 }
 const clayCss=String.raw`
 :is(.premium-nav-icon,.premium-dock-icon,.premium-stat-icon,.role-quick-icon,
 .edu-action-icon,.edu-search-icon,.edu-group-icon,.edu-chip-icon,
 .edu-auth-role-icon,.edu-guest-tab-icon,.edu-learning-card-icon,
 .edu-campus-icon,.feature-icon,.edu-button-icon,[data-edu-icon-key]){
 position:relative!important;isolation:isolate}
 .edu-clay-raster{
 position:absolute!important;inset:0!important;margin:auto!important;z-index:5!important;
 display:block!important;width:97%!important;height:97%!important;max-width:none!important;
 max-height:none!important;object-fit:contain!important;opacity:0!important;
 pointer-events:none!important;user-select:none!important;background:none!important;
 box-shadow:none!important;border:0!important;transition:opacity .16s ease!important}
 .edu-clay-raster.edu-clay-ready{opacity:1!important}
 :is(.premium-nav-icon,.premium-dock-icon,.premium-stat-icon,.role-quick-icon,
 .edu-action-icon,.edu-search-icon,.edu-group-icon,.edu-chip-icon,
 .edu-auth-role-icon,.edu-guest-tab-icon,.edu-learning-card-icon,
 .edu-campus-icon,.feature-icon,.edu-button-icon,[data-edu-icon-key]):has(>.edu-clay-ready)>.edu-vector-icon{
 opacity:0!important}
 body.page-home .quick-access-card .edu-button-icon,
 body.app-page.page-app :is(.premium-nav-icon,.premium-dock-icon,.premium-stat-icon,.edu-group-icon),
 body.auth-page .edu-auth-role-icon,
 body.learning-sky :is(.edu-learning-card-icon,.edu-guest-tab-icon){
 overflow:visible!important;
 background:linear-gradient(145deg,rgba(255,255,255,.16),rgba(222,249,239,.06))!important;
 box-shadow:none!important;border-color:transparent!important}
 body.page-home .quick-access-card .quick-actions .edu-button-icon{
 width:55px!important;height:55px!important;min-width:55px!important;flex:0 0 55px!important;padding:0!important}
 body.app-page.page-app .premium-nav-icon,
 body.app-page.page-app .nav-group>summary .edu-group-icon{
 width:43px!important;height:43px!important;min-width:43px!important;flex-basis:43px!important}
 @media(max-width:440px){
 body.page-home .quick-access-card .quick-actions .edu-button-icon{
 width:48px!important;height:48px!important;min-width:48px!important;flex-basis:48px!important}}
 `;
 function installClayStyle(){
  if(document.getElementById('edunizam-real-clay-style'))return;
  const style=document.createElement('style');style.id='edunizam-real-clay-style';
  style.textContent=clayCss;document.head.appendChild(style);
 }

 const paint=(el,key,tone)=>{
   if(!el||!P[key]||el.dataset.eduIconKey===key&&el.dataset.eduTone===tone)return;
   el.dataset.eduIconKey=key;el.dataset.eduTone=tone;
   el.innerHTML=clayMarkup(key);
 };
 const getView=(v)=>views[v]||['grid','teal'];
 function workspace(){
   if(!document.body?.classList.contains('page-app'))return;
   document.querySelectorAll('#nav .nav-item[data-view]').forEach(btn=>{
     const holder=btn.querySelector(':scope > .premium-nav-icon');
     if(holder){const [key,tone]=getView(btn.dataset.view);paint(holder,key,tone);}
   });
   document.querySelectorAll('#nav details.nav-group').forEach((g,i)=>{
     const sum=g.querySelector(':scope > summary');
     const holder=sum?.querySelector(':scope > span:first-child');
     if(!holder)return;
     const label=sum.querySelector('strong')?.textContent?.trim()||g.dataset.groupTitle||'';
     const [key,tone]=groupIcons[label]||Object.values(groupIcons)[i%7];
     holder.classList.add('edu-group-icon');
     paint(holder,key,tone);
   });
   document.querySelectorAll('#premiumMobileDock button').forEach(btn=>{
     const box=btn.querySelector('.premium-dock-icon');
     if(!box)return;
     const [key,tone]=btn.hasAttribute('data-premium-more')?['grid','violet']:getView(btn.dataset.premiumView);
     paint(box,key,tone);
   });
   const statIcons={statStudents:['users','sky'],statPresent:['attendance','green'],
     statFees:['banknote','amber'],statPending:['clock','rose']};
   Object.entries(statIcons).forEach(([id,icon])=>{
     const node=document.getElementById(id)?.closest('.stat')?.querySelector('.premium-stat-icon');
     paint(node,...icon);
   });
   document.querySelectorAll('#adminDailyDesk [data-admin-jump]').forEach(btn=>{
     const node=btn.querySelector(':scope > span:first-child');
     if(node){node.classList.add('edu-action-icon');paint(node,...getView(btn.dataset.adminJump));}
   });
   document.querySelectorAll('.role-quick-actions [data-role-quick]').forEach(btn=>{
     paint(btn.querySelector('.role-quick-icon'),...getView(btn.dataset.roleQuick));
   });
   const campus=document.getElementById('dashboardInstituteFallback');
   if(campus&&!campus.dataset.eduIconKey){campus.classList.add('edu-campus-icon');paint(campus,'school','teal');}
   const topIcons=[['.premium-context-chip.role','sparkle','violet'],['.premium-context-chip.school','school','sky'],['.premium-context-chip.date','calendar','amber']];
   topIcons.forEach(([sel,key,tone])=>{
     const item=document.querySelector(sel);if(!item||item.querySelector('.edu-chip-icon'))return;
     const first=item.firstChild;
     if(first?.nodeType===Node.TEXT_NODE)first.textContent=first.textContent.replace(/^[✦🏫📅]+\s*/u,'');
     const chip=document.createElement('span');chip.className='edu-chip-icon';chip.dataset.eduTone=tone;chip.innerHTML=clayMarkup(key);
     item.prepend(chip);
   });
   const searchIcon=document.querySelector('#premiumSearchTrigger>span:first-child');
   if(searchIcon){searchIcon.classList.add('edu-search-icon');paint(searchIcon,'search','sky');}
   const switchIcon=document.querySelector('#premiumWorkspaceSwitch>span:first-child');
   if(switchIcon){switchIcon.classList.add('edu-search-icon');paint(switchIcon,'arrows','teal');}
   const backTop=document.getElementById('eduBackTop');
   if(backTop)paint(backTop,'up','teal');
   document.querySelectorAll('#dashboard .campus-hero-actions [data-jump],#dashboard .quick-actions [data-jump]').forEach(btn=>{
     const [key,tone]=getView(btn.dataset.jump);actionIcon(btn,key,tone);
   });
 }
 function authentication(){
   if(!document.body?.classList.contains('auth-page'))return;
   const entries={admin:['school','sky'],teacher:['teacher','violet'],
     parent:['users','rose'],student:['cap','green']};
   document.querySelectorAll('#roleView .role[data-role]').forEach(node=>{
     const [key,tone]=entries[node.dataset.role]||['user','sky'];
     const holder=node.querySelector('.icon');
     if(holder){holder.classList.add('edu-auth-role-icon');paint(holder,key,tone);}
   });
   const admission=document.querySelector('#admissionApplicantRole .icon');
   if(admission){admission.classList.add('edu-auth-role-icon');paint(admission,'receipt','amber');}
   const guest=document.querySelector('#roleView .guest-role .icon');
   if(guest){guest.classList.add('edu-auth-role-icon');paint(guest,'study','teal');}
 }
 function learning(){
   if(!document.body?.classList.contains('learning-sky'))return;
   const tabs={home:['home','sky'],past:['paper','blue'],grade:['exam','green'],
     study:['study','violet'],universities:['landmark','amber'],
     competitive:['award','rose'],ecosystem:['target','teal'],pathways:['compass','sky'],
     vu:['laptop','violet'],practice:['pencil','green']};
   document.querySelectorAll('.tabs .tab[data-tab]').forEach(a=>{
     if(a.querySelector('.edu-guest-tab-icon'))return;
     const [key,tone]=tabs[a.dataset.tab]||['grid','blue'];
     const span=document.createElement('span');span.className='edu-guest-tab-icon';span.dataset.eduTone=tone;span.innerHTML=clayMarkup(key);a.prepend(span);
   });
   document.querySelectorAll('#homeCards [data-home-open]').forEach(a=>{
     if(a.querySelector('.edu-learning-card-icon'))return;
     const tab=a.dataset.homeOpen;
     const [key,tone]=tabs[tab]||['study','teal'];
     const b=document.createElement('span');b.className='edu-learning-card-icon';b.dataset.eduTone=tone;b.innerHTML=clayMarkup(key);
     const title=a.querySelector('h3');if(title)title.before(b);
   });
   const search=document.querySelector('.searchbox>span:first-child');
   if(search){search.classList.add('edu-search-icon');paint(search,'search','sky');}
   document.querySelectorAll('.hero-actions a[href]').forEach(btn=>{
     const href=btn.getAttribute('href')||'';
     const [key,tone]=href.includes('#vu')?['laptop','violet']:
       href.includes('#practice')?['pencil','rose']:['paper','sky'];
     actionIcon(btn,key,tone);
   });
 }
 // Decorative SVGs live inside existing links/buttons, preserving every click handler.
 const actionIcon=(el,key,tone)=>{
   if(!el||el.querySelector(':scope > .edu-button-icon'))return;
   const mark=document.createElement('span');
   mark.className='edu-button-icon';mark.dataset.eduTone=tone;
   mark.setAttribute('aria-hidden','true');mark.innerHTML=clayMarkup(key);
   el.prepend(mark);
 };
 function home(){
   if(!document.body?.classList.contains('page-home'))return;
   const icons=[['attendance','green'],['banknote','amber'],['results','sky'],['diary','violet'],['pencil','rose'],['study','teal']];
   document.querySelectorAll('.experience-strip article .feature-icon').forEach((el,i)=>paint(el,...icons[i%icons.length]));
   const quick=[
     ['.quick-access-card .quick-main','school','blue'],
     ['.quick-access-card .quick-actions a[href="learn.html"]','study','green'],
     ['.quick-access-card .quick-actions a[href="app.html"]','home','violet'],
     ['.quick-access-card .quick-actions button[data-pwa-install]','laptop','amber']
   ];
   quick.forEach(([selector,key,tone])=>actionIcon(document.querySelector(selector),key,tone));
 }
 function run(){workspace();authentication();learning();home();syncClayRenders();}
 let scheduled=false;
 function requestRun(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;run();});}
 function boot(){
   installClayStyle();
   run();
   const observer=new MutationObserver(mutations=>{
     if(mutations.some(m=>m.type==='childList'&&Array.from(m.addedNodes).some(n=>n.nodeType===1 && !n.classList?.contains('edu-vector-icon'))))requestRun();
   });
   observer.observe(document.body,{childList:true,subtree:true});
   document.addEventListener('edunizam:workspace-ready',requestRun);
   document.addEventListener('visibilitychange',()=>{if(!document.hidden)requestRun();});
   setTimeout(requestRun,450);setTimeout(requestRun,1600);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
 window.EDUNIZAM_COLOR_ICONS={refresh:requestRun,viewCount:Object.keys(views).length};
})();
