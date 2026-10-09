/* EduNizam Punjab school subject coverage pack, 2026-10-09.
 * PECTAA lists Tajveedi Qaida for Class I, Nazra Quran for II-V, and
 * Tarjuma-tul-Quran for VI-VIII. These ORIGINAL comprehension/readiness
 * exercises are NOT reproduced official books, prescribed chapter sequences,
 * recitation exams or verified board questions. Oral recitation is assessed
 * by a qualified teacher; retain Ethics/Akhlaqiat alternatives.
 * Official directory: https://pectaa.edu.pk/books-and-publications/
 */
(function(){
'use strict';
const URL='https://pectaa.edu.pk/books-and-publications/';
const rows=[
 [1,'Tajveedi Qaida',[
  ['Recognising Arabic Letters','Which Arabic letter is Alif?',['ا','ب','ت','ث'],0,'Alif is written ا. Recognition of letter shapes precedes connected reading.','Compare ا with ب and ت; their written shapes differ.','How can a learner recognise Alif among other letters?','Explain why recognising Arabic letter shapes correctly matters when reading aloud.'],
  ['Zabar (Fatha)','Which short-vowel sign is called zabar?',['ـَ','ـِ','ـُ','ـْ'],0,'Zabar (fatha) is a short vowel mark above a letter.','The sign َ above a consonant indicates the short a-vowel.','Where is zabar written relative to its letter?','Explain how zabar changes the pronunciation of a letter and why it should not be confused with zer.'],
  ['Teacher-Guided Pronunciation','What should a learner do after hearing a pronunciation correction?',['Repeat it carefully with the teacher','Ignore the correction','Skip the entire word','Read as fast as possible'],0,'Correct Arabic recitation is learnt by hearing and practising the letter sounds with a qualified teacher.','A learner listens, repeats the sound slowly, and asks the teacher to check it.','What is the helpful response to a teacher’s pronunciation correction?','Describe a safe practice routine for learning the pronunciation of unfamiliar Arabic letters.']
 ]],
 [2,'Nazra Quran',[
  ['Zer and Pesh','Which mark is known as pesh (damma)?',['ـُ','ـَ','ـِ','ـْ'],0,'Pesh is the short u-vowel mark, while zer is the short i-vowel mark.','Zer appears below a letter and pesh above it.','How do zer and pesh differ?','Compare zer and pesh in their written positions and corresponding short-vowel sounds.'],
  ['Sukoon (Jazm)','What does sukoon normally show on an Arabic consonant?',['No following short vowel on that consonant','A long vowel every time','A doubled letter','A question mark'],0,'Sukoon is used to show a consonant without an accompanying short vowel.','When a consonant bears ْ, read it without adding a new zabar, zer or pesh.','What is the basic purpose of sukoon?','Explain why inventing an extra short vowel at a sukoon can change a word’s pronunciation.'],
  ['Tashdeed (Shaddah)','What does the tashdeed sign indicate?',['Consonant strengthening or doubling','A full stop in Urdu','Always a long vowel','A change of alphabet'],0,'Tashdeed indicates a strengthened or doubled consonant sound.','A letter with ّ is not pronounced like an ordinary single consonant.','What is tashdeed used for?','Explain how a learner can practise distinguishing a letter with tashdeed from a single letter.']
 ]],
 [3,'Nazra Quran',[
  ['Tanween Signs','Which feature commonly characterises tanween in Arabic notation?',['A doubled short-vowel sign','A numeral before a word','A full stop','A capital letter'],0,'Tanween is represented by doubled short-vowel signs and normally adds an n-like ending in connected reading.','The marks ً, ٍ and ٌ represent three common tanween forms.','How is tanween generally indicated?','Explain how tanween signs differ visually from single vowel signs.'],
  ['Madd and Lengthening','What is the purpose of madd in recitation?',['Lengthening the appropriate vowel sound','Removing all consonants','Changing the word into Urdu','Always ending a sentence'],0,'Madd rules concern lengthening vowel sounds for appropriate durations under the rules taught.','A teacher demonstrates the correct length; not every sound is lengthened equally.','What does madd affect in recitation?','Explain why madd is practised with a teacher rather than guessed from a word’s appearance.'],
  ['Pause and Resume','What is a suitable action when reaching a marked recitation pause?',['Follow the learned stopping rule','Ignore all pause signs','Always stop in the middle of any word','Change the text'],0,'Waqf concerns appropriate stopping, and resuming needs attention to the meaning and taught recitation rules.','A learner observes the stop, takes a breath and restarts from a suitable place with teacher guidance.','What is waqf in reading practice?','Describe how suitable pauses can support accurate and clear recitation.']
 ]],
 [4,'Nazra Quran',[
  ['Makharij: Places of Articulation','What does the word makharij refer to in recitation study?',['Places where letter sounds are articulated','Names of all chapters','A method of page numbering','A type of punctuation in English'],0,'Makharij are the articulation points from which speech sounds are produced.','Some letters rely mainly on the lips while others involve particular tongue positions.','What are makharij?','Explain why learning correct articulation points may help distinguish similar-sounding letters.'],
  ['Ghunnah: Nasal Sound','Which description best fits ghunnah?',['A controlled nasal sound in certain recitation rules','Any long written word','A new Arabic consonant','Skipping a vowel'],0,'Ghunnah refers to a nasal resonance used in specified recitation contexts.','It should be taught by listening and guided practice, not by exaggerating every sound.','What does ghunnah refer to?','Explain why ghunnah must be applied only where the learned recitation rule calls for it.'],
  ['Qalqalah Letters','Which set contains the five commonly taught qalqalah letters?',['ق ط ب ج د','ا و ي م ن','س ش ص ض ظ','ف ك ل ر ه'],0,'The commonly taught qalqalah letters are ق ط ب ج د, with a characteristic rebound when applicable.','A teacher helps students distinguish qalqalah from inserting an extra vowel.','List the five commonly taught qalqalah letters.','Explain the aim of qalqalah practice and how it differs from adding a short vowel.']
 ]],
 [5,'Nazra Quran',[
  ['Measured Recitation (Tarteel)','Which is more suitable for improving clear recitation?',['Measured and accurate reading','Racing through each line','Skipping unfamiliar words','Removing vowel signs'],0,'Tarteel stresses clear, measured recitation and attention to the applicable rules.','A learner reads a manageable passage steadily and corrects errors rather than pursuing speed alone.','What does measured recitation involve?','Describe a practical routine for improving accuracy and fluency without sacrificing correct pronunciation.'],
  ['Recognising Long and Short Vowels','Why is it important to distinguish short from long vowels?',['Vowel length can affect correct pronunciation','Every vowel is always equally long','It makes consonants disappear','It replaces the need for listening'],0,'Arabic recitation distinguishes short vowel sounds from lengthened sounds in appropriate contexts.','Teachers demonstrate the duration instead of letting learners choose a random length.','What is the difference between a short and a long vowel sound?','Explain how incorrect vowel length may affect recitation and how a teacher can check it.'],
  ['Independent Reading with Feedback','What is the best way to check independent Nazra reading?',['Read aloud and receive teacher feedback','Assume every attempt is correct','Rely only on MCQ scores','Skip all difficult passages'],0,'Independent reading practice should be followed by qualified oral feedback.','The teacher listens for pronunciation, stopping and applicable tajweed before recording progress.','Why is listening feedback needed in Nazra Quran?','Describe how oral practice, correction and repetition complement written concept exercises.']
 ]],
 [6,'Tarjuma-tul-Quran',[
  ['Literal Meaning and Explanation','Which statement distinguishes translation from detailed explanation?',['A translation renders basic meaning; commentary adds context and interpretation','Both are always identical in length','A translation is only recitation','Commentary contains no explanation'],0,'A translation presents meaning in another language; tafsir or commentary discusses explanatory context and interpretation.','A learner may first read a reliable translation then consult an approved explanation with the teacher.','How are translation and explanation different?','Explain why a student should distinguish translated wording from a teacher’s additional explanation.'],
  ['Honesty and Trust','Which action best demonstrates honesty in daily life?',['Returning a found item to its owner','Claiming someone else’s work','Hiding a mistake to blame a friend','Changing another learner’s marks'],0,'Honesty means truthfulness, and trustworthiness includes protecting what others entrust to us.','Returning a classmate’s lost notebook demonstrates trustworthy conduct.','Define honesty and give a school example.','Discuss how honesty and trustworthy behaviour strengthen cooperation in a school.'],
  ['Gratitude and Responsibility','Which action demonstrates practical gratitude?',['Using resources responsibly and thanking helpers','Wasting drinking water deliberately','Taking credit for others’ efforts','Damaging shared school books'],0,'Gratitude involves recognising benefits and responding responsibly rather than taking them for granted.','Caring for shared books and expressing thanks are constructive responses.','What does gratitude mean in everyday conduct?','Explain how gratitude can influence care for school resources and relationships.']
 ]],
 [7,'Tarjuma-tul-Quran',[
  ['Justice and Fairness','Which classroom decision best shows fairness?',['Applying the same stated rules to everyone','Allowing favourites to break rules','Punishing without listening','Changing rules for one friend'],0,'Justice and fairness require principled treatment and careful attention to the relevant facts.','A teacher hears both sides of a dispute before making a proportionate decision.','How is fairness shown in a classroom?','Explain why fairness should include listening to evidence before making a judgement.'],
  ['Care and Respect for Parents','Which behaviour shows everyday respect for parents or guardians?',['Speaking courteously and helping where possible','Deliberately ignoring safety advice','Mocking their concerns','Taking shared possessions without asking'],0,'Respect includes polite speech, consideration and helpful action while maintaining safety and dignity.','A learner offers help with age-appropriate household tasks and listens carefully.','Give two ways to show respect to parents or guardians.','Describe how respectful communication can help resolve misunderstandings within a family.'],
  ['Accountability for Actions','What does personal accountability mean?',['Accepting responsibility and correcting mistakes','Blaming others for every error','Hiding relevant facts','Refusing to learn from feedback'],0,'Accountability is taking responsibility for one’s actions and seeking to repair errors.','A student acknowledges an incorrect submission and follows the teacher’s correction guidance.','What is accountability?','Discuss the steps a learner can take after recognising a mistake.']
 ]],
 [8,'Tarjuma-tul-Quran',[
  ['Reflection and Understanding','What does careful reflection on a studied text involve?',['Considering meaning and asking informed questions','Repeating words without considering the lesson','Ignoring all context','Assuming no explanation is useful'],0,'Reflection involves considering the meaning, context and practical implications of an authentic, reliably taught text.','A learner asks how a studied lesson relates to a fair decision at school.','What is meant by reflection on a studied passage?','Describe how a student can connect an understood lesson with a sensible real-life action.'],
  ['Fair Dealing','Which situation best illustrates fair dealing?',['Giving a truthful measure in a transaction','Secretly reducing the promised quantity','Making false claims about quality','Keeping another person’s change'],0,'Fair dealing means honest and equitable behaviour in transactions and promises.','A student managing a school stall gives accurate change and clear prices.','What is fair dealing?','Explain how fairness and honest information protect trust in everyday transactions.'],
  ['Care for Shared Resources','Which action best reflects responsibility for shared resources?',['Avoiding waste and protecting common property','Leaving taps running without need','Damaging a library book deliberately','Ignoring a reported hazard'],0,'Responsible care of resources reduces avoidable harm and protects shared wellbeing.','Turning off an unused tap and returning a borrowed book in good condition help others.','Give two examples of responsible use of shared resources.','Explain how caring for shared resources benefits both current learners and future users.']
 ]]
];
const S=window.EDUNIZAM_PUNJAB_SUBJECT_PACK={
 updatedAt:'2026-10-09',
 sourceUrl:URL,
 notes:'Subject listings verified against PECTAA; topic and question text are original concept practice, not official book chapters or exam papers. Oral assessment requires a teacher.',
 rows,
 applyToCatalog(catalog){
  if(!catalog)return;
  catalog.subjects=catalog.subjects||{};
  catalog.chapters=catalog.chapters||{};
  for(const [grade,subject,topics] of rows){
   const key=String(grade),pair=key+'|'+subject;
   catalog.subjects[key]=catalog.subjects[key]||[];
   if(!catalog.subjects[key].includes(subject))catalog.subjects[key].push(subject);
   catalog.subjects[key].sort();
   catalog.chapters[pair]=[...new Set([...(catalog.chapters[pair]||[]),...topics.map(t=>t[0])])].sort();
  }
  catalog.punjabQuranSource=URL;
  catalog.punjabQuranTopicsAreOfficialChapters=false;
 }
};
if(window.EDUNIZAM_ACADEMIC_OPTION_CATALOG)S.applyToCatalog(window.EDUNIZAM_ACADEMIC_OPTION_CATALOG);
function applyToPractice(){
const PD=window.EDUNIZAM_PRACTICE_DATA;
if(!PD)return;
 PD.subjects=PD.subjects||{};PD.chapters=PD.chapters||{};PD.questions=PD.questions||[];
 const have=new Set(PD.questions.map(q=>String(q.id)));
 const blueprint=window.EDUNIZAM_PRACTICE_EXTRA_BLUEPRINTS||{};
 let added=0,topicCount=0;
 function add(q){if(have.has(q.id))return;have.add(q.id);PD.questions.push(q);added++}
 for(const [grade,subject,topics] of rows){
  const level=String(grade),pair=level+'|'+subject;
  PD.subjects[level]=PD.subjects[level]||[];
  if(!PD.subjects[level].includes(subject))PD.subjects[level].push(subject);
  PD.chapters[pair]=PD.chapters[pair]||[];
  for(const [index,[chapter,mcq,options,correct,fact,example,shortQ,longQ]] of topics.entries()){
   if(!PD.chapters[pair].includes(chapter))PD.chapters[pair].push(chapter);
   blueprint[pair+'|'+chapter]={fact,example};topicCount++;
   const common={classLevel:grade,subject,chapter,origin:'EduNizam authored concept practice (PECTAA subject directory reference)',curriculumVerified:false};
   const id='pq-'+grade+'-'+index;
   add({...common,id:id+'-mcq',type:'mcq',difficulty:'Easy',question:mcq,options,answer:correct,explanation:fact+' '+example});
   add({...common,id:id+'-short',type:'short',difficulty:'Medium',question:shortQ,answerText:fact+' '+example});
   add({...common,id:id+'-long',type:'long',difficulty:'Hard',question:longQ,answerText:'Include: '+fact+' Example or application: '+example});
  }
  PD.subjects[level].sort();
  PD.chapters[pair].sort();
 }
 window.EDUNIZAM_PRACTICE_EXTRA_BLUEPRINTS=blueprint;
 PD.punjabQuranExpansion={updatedAt:'2026-10-09',topicGroups:topicCount,authoredItemsAdded:rows.reduce((n,r)=>n+r[2].length*3,0),newItemsThisLoad:added,sourceUrl:URL,verifiedTextbookChapters:false,oralRecitationNotAssessedByMCQ:true};
}
S.applyToPractice=applyToPractice;
applyToPractice();
function applyToStudy(){
const materials=window.EDUNIZAM_STUDY_DATA?.materials;
if(Array.isArray(materials)){
 const ids=new Set(materials.map(m=>m.id));
 for(const [grade,subject] of rows){
  const id='pectaa-quran-textbook-directory-'+grade;
  if(ids.has(id))continue;
  materials.push({id,board:'Punjab PECTAA',classLevels:[grade],subject,type:'Official Textbook Directory',
   title:'Class '+grade+' '+subject+' — PECTAA textbook directory',
   source:'official',url:URL,curriculumStatus:'needs-verification',
   note:'Official listing for this grade/subject. Browse the current book and confirm the relevant edition; this link is a directory, not a direct downloaded textbook. Concept practice does not replace oral teaching.'});
  ids.add(id);
 }
}
}
S.applyToStudy=applyToStudy;
applyToStudy();
})();