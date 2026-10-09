(function(){
'use strict';
/* EduNizam authored foundational concept practice, NOT an official PECTAA
   book transcription, chapter sequence or PEF exam item bank.
   Only show these questions as concept practice. Verify current prescribed
   textbook and school syllabus separately before using them in an exam. */
const PD=window.EDUNIZAM_PRACTICE_DATA;
if(!PD)return;
PD.subjects=PD.subjects||{};PD.chapters=PD.chapters||{};PD.questions=PD.questions||[];
const BLUEPRINTS=window.EDUNIZAM_PRACTICE_EXTRA_BLUEPRINTS||{};
const seen=new Set(PD.questions.map(q=>q.id));
let added=0,topics=0;
function addGrade(grade,subject,rows){
 const cl=String(grade);PD.subjects[cl]=PD.subjects[cl]||[];
 if(!PD.subjects[cl].includes(subject))PD.subjects[cl].push(subject);
 const k=cl+'|'+subject;PD.chapters[k]=PD.chapters[k]||[];
 for(const [chapter,question,options,answer,fact,example] of rows){
  if(!PD.chapters[k].includes(chapter))PD.chapters[k].push(chapter);
  const id='found-'+grade+'-'+subject.replace(/[^a-z0-9]/gi,'-').toLowerCase()+'-'+chapter.replace(/[^a-z0-9]/gi,'-').toLowerCase();
  if(!seen.has(id)){
    PD.questions.push({id,classLevel:grade,subject,chapter,type:'mcq',difficulty:'Easy',question,options,answer,explanation:fact+' '+example,origin:'EduNizam authored concept practice',curriculumVerified:false});
    seen.add(id);added++;
  }
  BLUEPRINTS[k+'|'+chapter]={fact,example};topics++;
 }
}
addGrade(1,'Mathematics',[
 ['Counting to 100','What number comes after 29?',['28','30','31','39'],1,'Counting forwards increases a whole number by one.','After 29 comes 30.'],
 ['Addition within 20','What is 8 + 5?',['11','12','13','14'],2,'Addition combines quantities to find a total.','Eight counters plus five counters make thirteen.'],
 ['Subtraction within 20','What is 12 − 4?',['6','7','8','9'],2,'Subtraction removes a quantity from a starting total.','12 pencils minus 4 pencils leaves 8 pencils.'],
 ['Basic Shapes','Which shape has exactly three sides?',['Circle','Square','Triangle','Rectangle'],2,'A triangle has three straight sides.','A roof drawn with three sides can form a triangle.']
]);
addGrade(1,'English',[
 ['Alphabet Sounds','Which letter begins the word "ball"?',['A','B','C','D'],1,'The first sound of ball is represented by B.','B is the first letter in ball.'],
 ['Simple Nouns','Which word names a person?',['run','happy','teacher','quickly'],2,'A noun can name a person, place, animal or thing.','Teacher names a person.'],
 ['Simple Sentences','Which sentence starts with a capital letter and ends with a full stop?',['the cat sleeps.','The cat sleeps.','The cat sleeps','the cat sleeps'],1,'An ordinary declarative sentence begins with a capital letter and ends with a full stop.','The cat sleeps.']
]);
addGrade(1,'Urdu',[
 ['حروف تہجی','لفظ "بکری" کس حرف سے شروع ہوتا ہے؟',['ا','ب','پ','ت'],1,'اردو میں لفظ کا ابتدائی حرف اس کے شروع میں لکھا جاتا ہے۔','بکری کا پہلا حرف ب ہے۔'],
 ['آسان الفاظ','ان میں سے پھل کا نام کون سا ہے؟',['کتاب','آم','میز','دروازہ'],1,'پھل کھانے کی قدرتی غذا کی ایک قسم ہے۔','آم ایک پھل ہے۔'],
 ['مختصر جملے','درست مکمل جملہ منتخب کریں۔',['باغ میں','میں سکول جاتا ہوں۔','سبز درخت کا','کتاب اور'],1,'مکمل جملہ واضح بات بیان کرتا ہے۔','میں سکول جاتا ہوں ایک مکمل جملہ ہے۔']
]);
addGrade(1,'General Knowledge',[
 ['Our Body','Which body part helps us see?',['Ear','Eye','Nose','Tongue'],1,'Eyes help us see shapes, colours and objects.','We use our eyes to read a picture.'],
 ['Healthy Habits','When should we wash our hands with soap?',['Before eating','Only once a week','Never after play','Only at night'],0,'Handwashing with soap helps remove germs.','Washing hands before eating is a good hygiene habit.'],
 ['Road Safety','Where should we cross a busy road when a marked crossing is available?',['Between parked cars','At a pedestrian crossing','Anywhere','Behind a turning bus'],1,'Marked pedestrian crossings are designed to help people cross more safely.','Look both ways and cross with an adult when necessary.']
]);
addGrade(1,'Islamiat / Ethics',[
 ['Truthfulness','Which action shows honesty?',['Hiding a mistake','Speaking the truth','Taking someone’s pencil','Making a false promise'],1,'Honesty means telling the truth and being trustworthy.','Admitting a mistake is an example of honesty.'],
 ['Respect for Others','Which action shows respect?',['Listening politely','Laughing at a classmate','Interrupting everyone','Pushing others'],0,'Respect includes polite speech, listening and considerate behaviour.','Listening to a classmate is respectful.'],
 ['Cleanliness','Which is a good cleanliness habit?',['Leaving litter','Washing hands','Sharing dirty cups','Avoiding bathing'],1,'Cleanliness includes personal hygiene and caring for surroundings.','Wash hands with soap before meals.']
]);
addGrade(2,'Mathematics',[
 ['Place Value','In 47, what is the value of digit 4?',['4','40','47','400'],1,'The tens place represents groups of ten.','4 tens is 40.'],
 ['Two-Digit Addition','What is 28 + 14?',['32','40','42','44'],2,'Adding two-digit numbers combines tens and ones with regrouping when needed.','28 + 14 equals 42.'],
 ['Two-Digit Subtraction','What is 52 − 19?',['23','33','43','41'],1,'Regrouping can help subtract ones when the top ones digit is smaller.','52 − 19 equals 33.'],
 ['Measurement of Length','Which unit is suitable for the length of a pencil?',['Kilometre','Litre','Centimetre','Kilogram'],2,'Short lengths are commonly measured in centimetres.','A pencil may be around 15 centimetres long.']
]);
addGrade(2,'English',[
 ['Nouns and Naming Words','Which is a common noun?',['Pakistan','Monday','river','Ali'],2,'A common noun names a general person, place, animal or thing.','River is a common noun.'],
 ['Simple Present Verbs','Choose the correct sentence.',['She walk home.','She walks home.','She walking home.','She walked home every now.'],1,'In the simple present, third-person singular subjects usually take an -s verb ending.','She walks home.'],
 ['Opposite Words','What is the opposite of "hot"?',['warm','cold','heat','fire'],1,'Opposite words express contrasting meanings.','Cold is opposite to hot.']
]);
addGrade(2,'Urdu',[
 ['اسم کی پہچان','ان الفاظ میں سے کسی جگہ کا نام کون سا ہے؟',['دوڑنا','سکول','تیز','خوش'],1,'اسم شخص، جگہ یا چیز کے نام کو کہتے ہیں۔','سکول ایک جگہ کا نام ہے۔'],
 ['متضاد الفاظ','"دن" کا متضاد کون سا ہے؟',['سورج','روشنی','رات','صبح'],2,'متضاد الفاظ ایک دوسرے کے الٹ معنی رکھتے ہیں۔','دن کا متضاد رات ہے۔'],
 ['املا','درست املا والا لفظ منتخب کریں۔',['کتاب','کتابب','کتابا','کتابپ'],0,'صحیح املا کے لیے لفظ کے حروف درست ترتیب سے لکھے جاتے ہیں۔','کتاب درست لکھا جاتا ہے۔']
]);
addGrade(2,'General Knowledge',[
 ['Living and Non-living Things','Which of these is a living thing?',['Stone','Chair','Tree','Spoon'],2,'Living organisms grow and carry out life processes.','A tree grows and needs water.'],
 ['Safe Drinking Water','Which water is safest to drink?',['Untreated puddle water','Properly treated clean water','Dirty canal water','Water with visible mud'],1,'Drinking water should be safe and free of disease-causing contamination.','Proper filtration and treatment can make water safer.'],
 ['Family and Community','Who helps put out fires in emergencies?',['Firefighter','Tailor','Farmer','Carpenter'],0,'Community helpers provide services that keep people safe and supported.','Firefighters respond to fires and other emergencies.']
]);
addGrade(2,'Islamiat / Ethics',[
 ['Helping Others','Which is a helpful action?',['Sharing a pencil with a classmate','Making fun of others','Blocking the door','Ignoring a hurt friend'],0,'Helping others includes kindness and practical support.','Sharing a spare pencil with someone in need is helpful.'],
 ['Good Manners','What is a polite response after receiving help?',['Move away silently','Say thank you','Shout loudly','Push ahead'],1,'Politeness includes gratitude and consideration.','Saying thank you expresses appreciation.'],
 ['Care for the Environment','What should you do with a wrapper?',['Drop it on the floor','Put it in a bin','Throw it on plants','Leave it in the corridor'],1,'Responsible conduct includes keeping shared spaces clean.','Use a waste bin for wrappers.']
]);
addGrade(3,'Mathematics',[
 ['Multiplication Facts','What is 7 × 6?',['36','40','42','49'],2,'Multiplication represents equal groups.','Seven groups of six total forty-two.'],
 ['Basic Division','What is 24 ÷ 6?',['3','4','5','6'],1,'Division shares or groups a quantity equally.','24 shared among 6 gives 4 each.'],
 ['Simple Fractions','Which fraction represents one of four equal parts?',['1/2','1/3','1/4','4/1'],2,'A fraction denominator counts equal parts in a whole.','One of four equal pieces is one quarter.'],
 ['Reading Time','What time is 30 minutes after 2:15?',['2:30','2:35','2:45','3:15'],2,'Half an hour is 30 minutes.','2:15 plus 30 minutes is 2:45.']
]);
addGrade(3,'English',[
 ['Singular and Plural','Choose the correct plural of "child".',['childs','children','childes','childrens'],1,'Some nouns have irregular plural forms.','The plural of child is children.'],
 ['Adjectives','Which word is an adjective in "The red kite flies"?',['The','red','kite','flies'],1,'Adjectives describe nouns.','Red describes the kite.'],
 ['Past Tense','Choose the simple past form of "eat".',['eated','eating','ate','eats'],2,'Irregular verbs may change spelling in the past tense.','The simple past of eat is ate.']
]);
addGrade(3,'Urdu',[
 ['واحد جمع','"لڑکا" کی درست جمع کیا ہے؟',['لڑکے','لڑکی','لڑکاپن','لڑکوں کی'],0,'واحد ایک اور جمع ایک سے زیادہ کو ظاہر کرتی ہے۔','لڑکا کی جمع لڑکے ہے۔'],
 ['فعل کی پہچان','جملے "علی کتاب پڑھتا ہے" میں فعل کون سا ہے؟',['علی','کتاب','پڑھتا ہے','کوئی نہیں'],2,'فعل کام یا حالت کو ظاہر کرتا ہے۔','پڑھتا ہے کام ظاہر کرتا ہے۔'],
 ['اسم صفت','"خوبصورت پھول" میں صفت کون سی ہے؟',['پھول','خوبصورت','میں','کوئی نہیں'],1,'صفت اسم کی خوبی یا حالت بتاتی ہے۔','خوبصورت پھول کی خوبی بیان کرتا ہے۔']
]);
addGrade(3,'General Knowledge',[
 ['Plants Need','Which does a green plant generally need for photosynthesis?',['Sunlight','Plastic','Smoke','Petrol'],0,'Green plants use light energy in photosynthesis.','Leaves use sunlight, water and carbon dioxide to make food.'],
 ['Weather','Which tool is used to measure air temperature?',['Ruler','Thermometer','Compass','Balance'],1,'A thermometer measures temperature.','Weather reports may give air temperature in degrees Celsius.'],
 ['Healthy Food','Which food is a good source of protein?',['Egg','Plain sugar','Soft drink','Salt'],0,'Protein contributes to growth and tissue repair.','Eggs provide protein.']
]);
addGrade(3,'Islamiat / Ethics',[
 ['Keeping Promises','Which behaviour shows responsibility?',['Keeping a reasonable promise','Breaking every agreement','Hiding important information','Blaming others'],0,'Keeping promises builds trust and responsibility.','Returning a borrowed book on the agreed day is responsible.'],
 ['Kindness to Animals','Which is kind treatment of animals?',['Giving appropriate water','Hurting them for fun','Leaving pets without care','Chasing nesting birds'],0,'Animals should be treated without cruelty and provided with suitable care.','Clean water is essential for pets.'],
 ['Fairness','What is fair during a classroom game?',['Changing rules for favourites','Following agreed rules for all','Taking every turn','Stopping others from playing'],1,'Fairness means applying agreed rules consistently.','Everyone follows the same turn-taking rule.']
]);
addGrade(4,'Mathematics',[
 ['Equivalent Fractions','Which fraction is equivalent to 1/2?',['1/4','2/4','2/3','3/4'],1,'Multiplying numerator and denominator by the same nonzero number preserves value.','1/2 equals 2/4.'],
 ['Decimal Numbers','Which decimal represents 3 tenths?',['0.03','0.3','3.0','0.003'],1,'The first decimal place shows tenths.','3/10 equals 0.3.'],
 ['Perimeter','What is the perimeter of a rectangle 6 cm by 4 cm?',['10 cm','16 cm','20 cm','24 cm'],2,'Rectangle perimeter is the sum of all four side lengths.','6 + 4 + 6 + 4 = 20 cm.'],
 ['Angles','What is a 90° angle called?',['Acute','Right','Obtuse','Straight'],1,'A right angle measures exactly 90 degrees.','A square corner is a right angle.']
]);
addGrade(4,'English',[
 ['Pronouns','Which pronoun can replace "Ayesha" in "Ayesha reads"?',['They','She','It','We'],1,'Subject pronouns replace a named subject.','She reads.'],
 ['Prepositions','Which word completes "The book is ___ the table" when it rests on top?',['on','under','between','behind'],0,'Prepositions express relationships such as location.','A book resting atop a table is on the table.'],
 ['Punctuation','Which punctuation ends a direct question?',['Full stop','Comma','Question mark','Colon'],2,'Direct written questions generally end with a question mark.','Where are you going?']
]);
addGrade(4,'Urdu',[
 ['مترادف الفاظ','"خوشی" کا قریب المعنی لفظ کون سا ہے؟',['غم','مسرت','تکلیف','جھگڑا'],1,'مترادف الفاظ کے معنی قریب ہوتے ہیں۔','خوشی اور مسرت قریب المعنی الفاظ ہیں۔'],
 ['زمانہ ماضی','کون سا جملہ ماضی کا ہے؟',['میں کھیلتا ہوں۔','میں کھیلوں گا۔','میں نے کھیلا۔','میں کھیل رہا ہوں۔'],2,'زمانہ ماضی گزرے ہوئے وقت کے کام کو ظاہر کرتا ہے۔','میں نے کھیلا گزشتہ عمل ہے۔'],
 ['واحد اور جمع','"کتاب" کی جمع کیا ہے؟',['کتابیں','کتابی','کتابا','کتابے'],0,'جمع ایک سے زیادہ چیزوں کی نشاندہی کرتی ہے۔','کتاب کی جمع کتابیں ہے۔']
]);
addGrade(4,'General Science',[
 ['States of Matter','Which state of matter has a definite volume but takes its container shape?',['Solid','Liquid','Gas','Plasma'],1,'A liquid has nearly fixed volume but no fixed shape.','Water takes the shape of a glass.'],
 ['Food Chains','What is a producer in a simple food chain?',['Green plant','Lion','Mushroom','Eagle'],0,'Producers make their own food, usually by photosynthesis.','Grass is a producer eaten by herbivores.'],
 ['Human Senses','Which organ detects sound?',['Eye','Ear','Skin','Tongue'],1,'The ear receives sound vibrations and supports hearing.','We listen with our ears.']
]);
addGrade(4,'Islamiat / Ethics',[
 ['Honesty in Exams','Which action shows academic honesty?',['Copying answers','Using only permitted help','Hiding notes during a closed-book exam','Sharing answer keys secretly'],1,'Academic honesty means following assessment rules and presenting your own work.','A learner completes a closed-book test without hidden notes.'],
 ['Respecting Parents and Teachers','Which response is respectful?',['Listening calmly','Shouting over a speaker','Ignoring requests without reason','Mocking others'],0,'Respect includes polite communication.','Listen politely even if you disagree.'],
 ['Helping Neighbours','Which is an example of good neighbourliness?',['Helping an elderly neighbour carry groceries','Blocking their gate','Playing loud music all night','Damaging shared plants'],0,'Being a good neighbour includes offering respectful assistance.','Helping someone carry a heavy bag can be kind.']
]);
addGrade(4,'Social Studies',[
 ['Maps and Directions','Which direction is opposite north?',['East','West','South','North-east'],2,'The four main compass directions are north, south, east and west.','South lies opposite north.'],
 ['Pakistan Provinces','Which is a province of Pakistan?',['Lahore','Punjab','Karachi','Islamabad'],1,'Punjab is one of Pakistan’s provinces.','Lahore is a city within Punjab.']
]);
addGrade(6,'Mathematics',[
 ['Integers','What is −3 + 7?',['−10','−4','4','10'],2,'Adding opposite-signed integers finds the difference in magnitudes.','−3 + 7 = 4.'],
 ['Fractions and Operations','What is 1/3 + 1/6?',['2/9','1/2','2/6','1/9'],1,'Fractions need a common denominator for addition.','2/6 + 1/6 = 3/6 = 1/2.'],
 ['Ratio','What is the simplified ratio of 6 to 9?',['3:2','2:3','6:3','1:9'],1,'Divide both ratio terms by their common factor.','6:9 simplifies to 2:3.'],
 ['Basic Algebra','If x + 5 = 12, what is x?',['5','6','7','8'],2,'An equation is balanced by applying the same operation to both sides.','Subtract five from both sides to get x = 7.']
]);
addGrade(6,'English',[
 ['Subject-Verb Agreement','Choose the correct sentence.',['The boys plays cricket.','The boys play cricket.','The boys playing cricket.','The boys has play cricket.'],1,'Plural subjects generally take the base form of the present-tense verb.','The boys play cricket.'],
 ['Adverbs','Which word is an adverb in "She spoke softly"?',['She','spoke','softly','none'],2,'Adverbs can describe how an action occurs.','Softly tells how she spoke.'],
 ['Conjunctions','Which word correctly joins "I studied" and "I passed" as cause and result?',['because','so','although','unless'],1,'So can introduce a result.','I studied, so I passed.']
]);
addGrade(6,'Urdu',[
 ['اسم فعل حرف','جملے "وہ تیزی سے دوڑا" میں فعل کون سا ہے؟',['وہ','تیزی','سے','دوڑا'],3,'فعل کسی کام کے ہونے کو ظاہر کرتا ہے۔','دوڑا فعل ہے۔'],
 ['محاورہ','محاورہ "ہاتھ بٹانا" کا مفہوم کیا ہے؟',['رکاوٹ ڈالنا','مدد کرنا','لڑائی کرنا','چھپ جانا'],1,'محاورے کا مطلب اکثر لفظی معنی سے مختلف ہوتا ہے۔','ہاتھ بٹانا مدد کرنا ہے۔'],
 ['زمانہ مستقبل','کون سا جملہ مستقبل کا ہے؟',['میں کل گیا تھا۔','میں اب پڑھتا ہوں۔','میں کل جاؤں گا۔','میں نے کھایا۔'],2,'زمانہ مستقبل آئندہ ہونے والے کام کو ظاہر کرتا ہے۔','جاؤں گا مستقبل کی علامت ہے۔']
]);
addGrade(6,'General Science',[
 ['Plant Photosynthesis','Which gas do green plants take in for photosynthesis?',['Oxygen','Carbon dioxide','Nitrogen only','Helium'],1,'Plants use carbon dioxide and water with light energy for photosynthesis.','Leaves take in CO₂ through stomata.'],
 ['Electric Circuits','What happens when a simple circuit switch is open?',['Current flows normally','The circuit path is broken','The battery voltage doubles','The bulb becomes a generator'],1,'A broken circuit path prevents sustained current in a simple series circuit.','An open switch turns off a bulb in a simple circuit.'],
 ['Forces and Motion','Which force opposes motion between touching surfaces?',['Gravity','Friction','Magnetism','Buoyancy'],1,'Friction acts between surfaces and opposes their relative motion.','Shoe soles grip the ground through friction.']
]);
addGrade(6,'Islamiat / Ethics',[
 ['Integrity','What best demonstrates integrity?',['Doing the right thing when unobserved','Being kind only when rewarded','Cheating if no one notices','Making false promises'],0,'Integrity is acting consistently with ethical principles.','Return lost property even when no one is watching.'],
 ['Community Service','Which action helps the community?',['Organising a safe cleanup','Littering in public','Damaging school furniture','Blocking access ramps'],0,'Community service uses effort to benefit others.','A supervised cleanliness drive benefits shared spaces.'],
 ['Fair Disagreement','How should classmates respond to different views?',['Insult the speaker','Listen and disagree respectfully','Stop the discussion by force','Spread rumours'],1,'Respectful disagreement considers evidence without personal attacks.','Criticise ideas politely, not people.']
]);
addGrade(6,'Social Studies',[
 ['Latitude and Longitude','Which lines measure distance north or south of the equator?',['Lines of longitude','Lines of latitude','Time zones','Contours'],1,'Latitude measures angular position north or south of the equator.','The equator lies at 0° latitude.'],
 ['Early Civilizations','Which river is most closely associated with the Indus Valley Civilization?',['Nile','Indus','Thames','Amazon'],1,'Indus Valley settlements developed in the Indus River basin.','Mohenjo-daro is associated with the Indus civilization.']
]);
addGrade(7,'Mathematics',[
 ['Percentages','What is 25% of 80?',['10','15','20','25'],2,'A percentage is a quantity out of a hundred.','0.25 × 80 equals 20.'],
 ['Rational Numbers','Which number is rational?',['√2','π','3/5','√3'],2,'A rational number can be written as an integer ratio with nonzero denominator.','3/5 is rational.'],
 ['Linear Equations','Solve 3x − 4 = 11.',['3','4','5','7'],2,'Solve a linear equation by isolating the variable with equal operations on both sides.','3x = 15, so x = 5.'],
 ['Data and Averages','What is the mean of 4, 6, 8 and 10?',['6','7','8','9'],1,'The arithmetic mean is the total divided by the count.','(4+6+8+10)/4 = 7.']
]);
addGrade(7,'English',[
 ['Active and Passive Voice','Which is passive voice?',['The girl wrote a letter.','A letter was written by the girl.','The girl is writing.','The girl writes neatly.'],1,'In the passive voice, the object of an active clause can become the subject.','A letter was written by the girl uses was plus past participle.'],
 ['Direct and Indirect Speech','Which sentence correctly reports: He said, "I am tired."?',['He said that he was tired.','He said that I am tired.','He said that he be tired.','He says he tired.'],0,'Reported speech often shifts the original present tense back when the reporting verb is past.','He said that he was tired.'],
 ['Paragraph Organisation','Which sentence works best as a topic sentence?',['For example, one mango fell.','Healthy exercise benefits the body in several ways.','And then it happened.','Because it was.'],1,'A topic sentence introduces a paragraph’s main idea.','A paragraph about exercise can explain several health benefits.']
]);
addGrade(7,'Urdu',[
 ['قواعد و گرامر','جملے "محنتی طالب علم کامیاب ہوا" میں صفت کون سی ہے؟',['طالب علم','ہوا','محنتی','کامیاب'],2,'صفت اسم کی خوبی بیان کرتی ہے۔','محنتی طالب علم کی صفت ہے۔'],
 ['مترادف و متضاد','"جرأت" کا قریب المعنی لفظ کون سا ہے؟',['بزدلی','ہمت','خوف','بے خبری'],1,'مترادف الفاظ قریب المعنی ہوتے ہیں۔','جرأت اور ہمت قریب المعنی ہیں۔'],
 ['خط و درخواست','رسمی درخواست میں کس انداز کی زبان مناسب ہے؟',['بے ادبی پر مبنی','واضح اور مؤدبانہ','غیر متعلقہ لطیفوں والی','غیر واضح'],1,'رسمی درخواست میں مقصد مختصر اور احترام کے ساتھ واضح کیا جاتا ہے۔','مؤدبانہ الفاظ اور واضح درخواست مناسب ہیں۔']
]);
addGrade(7,'General Science',[
 ['Atoms and Elements','What is the smallest particle of an element retaining its chemical identity?',['Cell','Atom','Tissue','Organ'],1,'Atoms are the basic units of chemical elements.','A carbon atom belongs to the element carbon.'],
 ['Heat Transfer','Which process transfers heat through direct contact?',['Conduction','Radiation','Evaporation','Reflection'],0,'Conduction transfers thermal energy through particle interactions within materials or between contacting materials.','A metal spoon warms in hot soup by conduction.'],
 ['Ecosystems','What is a decomposer?',['An organism that breaks down dead organic matter','Only a plant that produces food','Only a predator','A nonliving rock'],0,'Decomposers help recycle nutrients by breaking down organic matter.','Fungi can act as decomposers.']
]);
addGrade(7,'Islamiat / Ethics',[
 ['Justice and Fairness','Which action demonstrates justice?',['Listening to evidence before deciding','Favouring only friends','Punishing without checking facts','Ignoring fair rules'],0,'Fair decisions consider facts and apply rules consistently.','Hear both sides before making a decision.'],
 ['Responsible Technology Use','Which online habit is responsible?',['Share passwords with strangers','Respect privacy and verify sources','Publish private messages without permission','Spread rumours'],1,'Digital responsibility includes protecting privacy and checking information.','Ask permission before sharing another person’s photo.'],
 ['Cooperation','Which action improves teamwork?',['Sharing tasks fairly','Refusing all feedback','Hiding useful information','Blaming teammates'],0,'Cooperation involves communication and balanced contribution.','Divide responsibilities fairly among group members.']
]);
addGrade(7,'Social Studies',[
 ['Earth and Climate','What is climate?',['Conditions at one exact hour','Long-term patterns of weather','The name of a single storm','Only the rainfall today'],1,'Climate describes patterns of weather measured over long periods.','A region’s typical summer temperature is part of its climate.'],
 ['Civic Responsibilities','Which action is a civic responsibility?',['Damaging public property','Respecting public rules and shared spaces','Spreading misinformation','Ignoring safety rules'],1,'Civic responsibility includes acting with care for public resources.','Keeping public parks clean shows civic responsibility.']
]);
for(const cl of Object.keys(PD.subjects))PD.subjects[cl].sort((a,b)=>a.localeCompare(b));
for(const key of Object.keys(PD.chapters))PD.chapters[key].sort((a,b)=>a.localeCompare(b));
window.EDUNIZAM_PRACTICE_EXTRA_BLUEPRINTS=BLUEPRINTS;
window.EDUNIZAM_FOUNDATION_PRACTICE={updatedAt:'2026-10-09',grades:[1,2,3,4,6,7],curatedMcqsAdded:added,topicGroups:topics,source:'EduNizam-authored foundation practice (not official textbooks)',officialBookDirectory:'https://pectaa.edu.pk/books-and-publications/',officialCurriculum:'https://pectaa.edu.pk/curriculum-compliance/'};
})();