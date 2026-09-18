window.EDUNIZAM_ADMISSIONS_DATA={
  institutionTypes:[
    {id:"school",name:"School",levels:["Play Group","Nursery","Prep","Grade 1","Grade 2","Grade 3","Grade 4","Grade 5","Grade 6","Grade 7","Grade 8","Grade 9","Grade 10"]},
    {id:"college",name:"College",levels:["FA","FSc Pre-Medical","FSc Pre-Engineering","ICS","ICom","ADP","BS Program"]},
    {id:"academy",name:"Academy / Institute",levels:["Entry Test","Computer Course","Language Course","Professional Diploma","Short Course","Custom Program"]},
    {id:"university",name:"University",levels:["Associate Degree","BS Program","B.Ed","M.Ed","MS / MPhil","PhD","Diploma / Certificate"]}
  ],
  statuses:["Draft","Submitted","Under Review","Documents Pending","Test / Interview","Merit List","Selected","Waitlisted","Rejected","Admitted"],
  quotas:["Open Merit","General","Sports","Disabled","Minority","Employee / Staff","Overseas","Self Finance","Other"],
  documentTypes:[
    "Applicant CNIC / B-Form",
    "Father / Guardian CNIC",
    "Passport-size Photograph",
    "Previous Result Card / Transcript",
    "School Leaving / Character Certificate",
    "Domicile",
    "Migration / NOC",
    "Equivalence Certificate",
    "Hafiz / Sports / Quota Certificate",
    "Other Supporting Document"
  ],
  qualificationLevels:["No Previous Qualification","Primary","Middle","Matric / SSC","Intermediate / HSSC","Associate Degree","Bachelor","Master","MS / MPhil","PhD"],
  paymentMethods:[
    {id:"cash",name:"Cash at Institution",mode:"manual"},
    {id:"bank",name:"Bank Deposit / Bank Transfer",mode:"manual"},
    {id:"raast",name:"Raast / Raast QR",mode:"manual-or-gateway"},
    {id:"jazzcash",name:"JazzCash",mode:"manual-or-gateway"},
    {id:"easypaisa",name:"Easypaisa",mode:"manual-or-gateway"},
    {id:"card",name:"Debit / Credit Card (Online Gateway)",mode:"gateway"},
    {id:"challan",name:"Printed Challan",mode:"manual"}
  ],
  defaultSetup:{
    institutionName:"EduNizam Demo Institute",
    institutionType:"school",
    admissionSession:"2026-27",
    applicationFee:0,
    currency:"PKR",
    applicationPrefix:"ADM",
    requireTest:false,
    requireInterview:false,
    enabledPaymentMethods:["cash","bank","raast","jazzcash","easypaisa","challan"],
    bankName:"",
    bankAccountTitle:"",
    bankIban:"",
    raastId:"",
    jazzCashNumber:"",
    jazzCashTitle:"",
    easypaisaNumber:"",
    easypaisaTitle:"",
    gatewayProvider:"Not connected",
    gatewayMode:"manual"
  }
};