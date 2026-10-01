(function(){
'use strict';
const PD=window.EDUNIZAM_PRACTICE_DATA;
if(!PD)return;

const B={
'5|Mathematics|Whole Numbers':{fact:'Whole numbers are 0, 1, 2, 3 and so on, and place value tells the value of a digit by its position.',example:'In 47,215, the digit 7 represents 7,000.'},
'5|Mathematics|Fractions and Decimals':{fact:'Fractions represent parts of a whole, and decimals are another way to write fractional quantities based on powers of ten.',example:'1/2 is equal to 0.5.'},
'5|Mathematics|Geometry':{fact:'Geometry studies shapes, lines, angles and their properties.',example:'A rectangle has four right angles and opposite sides of equal length.'},
'5|Mathematics|Measurement':{fact:'Measurement compares quantities such as length, mass, capacity and time using standard units.',example:'3 metres are equal to 300 centimetres.'},
'5|English|Grammar':{fact:'Grammar gives rules for forming correct words, phrases and sentences.',example:'In “She goes to school,” the singular subject “She” takes “goes.”'},
'5|English|Vocabulary':{fact:'Vocabulary is the set of words a learner understands and uses, including meanings, synonyms and antonyms.',example:'“Quick” is a synonym of “fast,” while “slow” is an antonym.'},
'5|English|Reading Skills':{fact:'Reading comprehension means understanding a passage, identifying its main idea and finding supporting details.',example:'After reading a short paragraph, a learner can state what it is mainly about and cite one detail.'},
'5|Urdu|قواعد':{fact:'اردو قواعد زبان کو درست طور پر بولنے اور لکھنے کے اصول سکھاتی ہے، جیسے اسم، فعل اور صفت۔',example:'جملہ “علی کتاب پڑھتا ہے” میں “پڑھتا ہے” فعل ہے۔'},
'5|Urdu|الفاظ و معانی':{fact:'الفاظ و معانی میں لفظ کے مطلب، مترادف اور متضاد کو سمجھنا شامل ہے۔',example:'“خوش” کا متضاد “اداس” ہے۔'},
'5|Urdu|فہم':{fact:'فہم میں عبارت پڑھ کر مرکزی خیال، اہم معلومات اور سوالات کے جواب اخذ کیے جاتے ہیں۔',example:'مختصر عبارت پڑھ کر اس کا مرکزی خیال ایک جملے میں لکھنا فہم کی مشق ہے۔'},
'5|General Science|Living Things':{fact:'Living things carry out life processes such as growth, respiration, nutrition and reproduction.',example:'A plant grows, uses water and light, and reproduces through seeds.'},
'5|General Science|Matter':{fact:'Matter has mass and occupies space, and it commonly exists as solid, liquid or gas.',example:'Ice, liquid water and water vapour are three states of the same substance.'},
'5|General Science|Energy':{fact:'Energy is the ability to cause change or do work and can appear in forms such as light, heat and motion.',example:'Sunlight provides light and heat energy to Earth.'},
'5|General Science|Earth and Environment':{fact:'The environment includes air, water, land and living things, and human actions can protect or damage it.',example:'Reducing waste and planting trees can help protect the environment.'},
'5|Islamiat / Ethics|Basic Teachings':{fact:'Basic moral teachings include truthfulness, respect, responsibility, kindness and fulfilling duties.',example:'Returning a lost item to its owner is an example of honesty and responsibility.'},
'5|Islamiat / Ethics|Good Character':{fact:'Good character is shown through honesty, kindness, patience, fairness and respect for others.',example:'Helping a classmate without expecting a reward is an example of kindness.'},

'8|Mathematics|Rational Numbers':{fact:'A rational number can be written as a fraction p/q where p and q are integers and q is not zero.',example:'3/5 and -7/2 are rational numbers.'},
'8|Mathematics|Algebra':{fact:'Algebra uses symbols such as x to represent unknown quantities and applies operations to solve equations.',example:'From 2x + 6 = 16, subtract 6 and divide by 2 to get x = 5.'},
'8|Mathematics|Geometry':{fact:'Geometry uses properties of angles, triangles and other shapes to solve spatial problems.',example:'The interior angles of a triangle add up to 180 degrees.'},
'8|Mathematics|Data Handling':{fact:'Data handling includes collecting, organizing, representing and interpreting data using measures and graphs.',example:'The mean of 4, 6, 8 and 10 is 7.'},
'8|English|Grammar':{fact:'Grammar helps a writer use correct sentence structure, tense, agreement and punctuation.',example:'“She goes to school daily” has correct subject-verb agreement.'},
'8|English|Vocabulary':{fact:'Vocabulary work develops accurate word meanings, synonyms, antonyms and context-based usage.',example:'“Rapid” and “quick” are synonyms.'},
'8|English|Reading Skills':{fact:'Reading skills include identifying the main idea, making inferences and locating evidence in a passage.',example:'A reader can support an inference by pointing to a sentence from the passage.'},
'8|Urdu|قواعد':{fact:'اردو قواعد میں اسم، فعل، صفت، ضمیر اور جملے کی ساخت کے درست استعمال کو سمجھا جاتا ہے۔',example:'“خوبصورت پھول” میں “خوبصورت” صفت ہے۔'},
'8|Urdu|الفاظ و معانی':{fact:'الفاظ و معانی میں لفظ کے مفہوم، مترادف، متضاد اور سیاق کے مطابق استعمال کو سمجھنا شامل ہے۔',example:'“آغاز” کا متضاد “اختتام” ہے۔'},
'8|Urdu|فہم':{fact:'فہم میں عبارت کے مرکزی خیال، مصنف کے مقصد اور اہم شواہد کو سمجھ کر جواب دیا جاتا ہے۔',example:'عبارت سے ایک دلیل تلاش کر کے اس کی بنیاد پر نتیجہ اخذ کرنا فہم کی مشق ہے۔'},
'8|General Science|Cells and Life':{fact:'The cell is the basic structural and functional unit of living organisms.',example:'Muscle cells and nerve cells have specialized structures for different jobs.'},
'8|General Science|Matter and Chemistry':{fact:'Matter is made of particles, and chemical changes produce substances with new properties.',example:'Rusting iron is a chemical change because new substances form.'},
'8|General Science|Force and Energy':{fact:'A force can change motion, while energy is needed to cause physical changes or perform work.',example:'Pushing a trolley changes its motion, and the SI unit of force is the newton.'},
'8|General Science|Earth and Space':{fact:'Earth rotates on its axis and revolves around the Sun, while the solar system contains the Sun and objects orbiting it.',example:'One revolution of Earth around the Sun takes about 365 days.'},
'8|Islamiat / Ethics|Basic Teachings':{fact:'Core ethical teachings emphasize honesty, justice, responsibility, respect and care for others.',example:'Keeping a promise is a practical example of trustworthiness.'},
'8|Islamiat / Ethics|Good Character':{fact:'Good character is demonstrated by fair, respectful and responsible conduct in daily life.',example:'Treating two people by the same fair rule is an example of justice.'},

'9|Biology|Cell Biology':{fact:'Cell biology studies cell structure and function, including organelles and the processes that keep cells alive.',example:'Mitochondria release usable energy during cellular respiration.'},
'9|Biology|Cells and Tissues':{fact:'Cells are basic units of life, and similar specialized cells can form tissues that perform particular functions.',example:'Muscle tissue is made of cells specialized for contraction.'},
'9|Chemistry|Periodic Table':{fact:'The periodic table arranges elements by atomic number and shows repeating trends in their chemical properties.',example:'An atom with three occupied electron shells belongs to Period 3.'},
'9|Chemistry|Structure of Atoms':{fact:'Atoms contain protons and neutrons in the nucleus and electrons around the nucleus.',example:'An electron has negative charge, while a proton has positive charge.'},
'9|Computer Science|Algorithms':{fact:'An algorithm is a finite, ordered set of clear steps for solving a problem or completing a task.',example:'A recipe-like sequence for finding the largest of three numbers is an algorithm.'},
'9|Computer Science|Computer Basics':{fact:'A computer system combines hardware, software, input, processing, storage and output.',example:'The CPU processes instructions while RAM temporarily holds active data.'},
'9|English|Grammar':{fact:'English grammar controls sentence structure, tense, agreement, voice and other rules for clear communication.',example:'“She has finished her work” is a correct present-perfect sentence.'},
'9|Islamiat / Ethics|Basic Beliefs and Worship':{fact:'This topic connects core beliefs, worship and responsible moral conduct, emphasizing sincerity and duty.',example:'Regular worship and truthful behaviour both reflect commitment to one’s values and responsibilities.'},
'9|Mathematics|Linear Equations':{fact:'A linear equation has variables to the first power and can be solved by performing the same valid operation on both sides.',example:'3x + 5 = 20 gives x = 5.'},
'9|Mathematics|Matrices and Determinants':{fact:'A matrix is a rectangular array of numbers, and its order is stated as rows by columns.',example:'A matrix with 2 rows and 3 columns has order 2 × 3.'},
'9|Mathematics|Real and Complex Numbers':{fact:'Real numbers include rational and irrational numbers, while complex numbers can include a real part and an imaginary part.',example:'√2 is irrational, whereas 1/2 is rational.'},
'9|Pakistan Studies|Pakistan Movement':{fact:'The Pakistan Movement was a political struggle that led to the creation of Pakistan in 1947.',example:'Key developments included political organization, constitutional demands and negotiations before independence.'},
'9|Physics|Dynamics':{fact:'Dynamics studies how forces affect motion and is closely linked with Newton’s laws of motion.',example:'A net force on an object causes acceleration according to F = ma.'},
'9|Physics|Kinematics':{fact:'Kinematics describes motion using quantities such as displacement, velocity and acceleration without focusing on its causes.',example:'Velocity is displacement per unit time and is measured in m/s.'},
'9|Urdu|قواعد':{fact:'اردو قواعد میں جملے کی ساخت اور اسم، فعل، صفت، ضمیر وغیرہ کے درست استعمال کے اصول شامل ہیں۔',example:'“خوبصورت پھول” میں “خوبصورت” صفت ہے۔'},

'10|Biology|Gaseous Exchange':{fact:'Gaseous exchange is the movement of respiratory gases between an organism and its environment.',example:'In human lungs, oxygen and carbon dioxide are exchanged mainly across alveoli.'},
'10|Biology|Homeostasis':{fact:'Homeostasis keeps internal conditions within suitable limits despite changes inside or outside the body.',example:'The kidneys help regulate water and salt balance.'},
'10|Chemistry|Acids Bases and Salts':{fact:'Acids, bases and salts have characteristic properties, and pH indicates how acidic or basic a solution is.',example:'A solution with pH below 7 is acidic.'},
'10|Chemistry|Chemical Equilibrium':{fact:'At dynamic equilibrium, forward and reverse reactions continue at equal rates so macroscopic concentrations remain constant.',example:'In a closed reversible reaction, equilibrium is reached when the two reaction rates become equal.'},
'10|Computer Science|Databases':{fact:'A database stores structured data so it can be organized, searched and updated efficiently.',example:'A primary key uniquely identifies a record in a table.'},
'10|Computer Science|Web Basics':{fact:'Web pages are commonly structured with HTML and styled with CSS, while browsers display the resulting content.',example:'HTML can define a heading and CSS can control its size and spacing.'},
'10|English|Grammar':{fact:'Grammar at this level includes accurate tense, voice, reported speech, agreement and punctuation.',example:'“Ali said that he was tired” is an appropriate reported-speech form in a past reporting context.'},
'10|Islamiat / Ethics|Moral Conduct':{fact:'Moral conduct means applying honesty, fairness, self-control, respect and responsibility in real situations.',example:'Admitting a mistake instead of blaming another person shows honesty and responsibility.'},
'10|Mathematics|Quadratic Equations':{fact:'A quadratic equation has highest power 2 and can be solved by methods such as factorization, completing the square or the quadratic formula.',example:'For ax² + bx + c = 0, the discriminant is b² − 4ac.'},
'10|Mathematics|Trigonometry':{fact:'Trigonometry relates angles and side ratios, including sine, cosine and tangent.',example:'The identity sin²θ + cos²θ = 1 is fundamental in trigonometry.'},
'10|Pakistan Studies|Constitutional Development':{fact:'Constitutional development studies how Pakistan’s constitutional frameworks and institutions evolved over time.',example:'A constitution defines institutions, powers, rights and procedures for government.'},
'10|Physics|Current Electricity':{fact:'Current electricity studies the flow of electric charge and relationships among current, voltage and resistance.',example:'Ohm’s law is V = IR for an ohmic conductor under suitable conditions.'},
'10|Urdu|قواعد':{fact:'اردو قواعد زبان کی درست ساخت، ضمیر، فعل، صفت اور جملوں کے باقاعدہ استعمال کو واضح کرتی ہے۔',example:'اسم کی جگہ استعمال ہونے والا لفظ ضمیر کہلاتا ہے۔'},

'11|Biology|Cell Structure':{fact:'Cell structure links organelles and cell components with their specialized biological functions.',example:'Ribosomes synthesize proteins, while mitochondria are central to aerobic energy release.'},
'11|Chemistry|Basic Concepts':{fact:'Basic chemistry concepts include amount of substance, moles, molar mass, formulas and quantitative relationships.',example:'One mole contains approximately 6.022 × 10²³ representative particles.'},
'11|Computer Science|Problem Solving':{fact:'Computational problem solving involves defining a problem, designing an algorithm, testing it and refining the solution.',example:'Breaking a large task into smaller steps is decomposition.'},
'11|English|Grammar':{fact:'Advanced grammar supports precise sentence structure, punctuation, agreement and coherent expression.',example:'An introductory conjunctive adverb such as “However” is commonly followed by a comma.'},
'11|Islamiat / Ethics|Social Responsibility':{fact:'Social responsibility means considering how personal choices affect other people and the wider community.',example:'Protecting public property and helping vulnerable people are examples of responsible citizenship.'},
'11|Mathematics|Permutation Combination Probability':{fact:'Permutations count ordered arrangements, combinations count selections without order, and probability measures likelihood.',example:'Choosing 2 students from 5 uses a combination because order does not matter.'},
'11|Mathematics|Quadratic Equations':{fact:'Quadratic equations can be analyzed through roots, discriminant, factorization and the quadratic formula.',example:'If b² − 4ac is positive, a real quadratic equation has two distinct real roots.'},
'11|Mathematics|Sequences and Series':{fact:'A sequence is an ordered list of terms, while a series is the sum of terms in a sequence.',example:'For an arithmetic sequence, aₙ = a + (n − 1)d.'},
'11|Physics|Vectors and Equilibrium':{fact:'Vectors have magnitude and direction, and an object is in equilibrium when the resultant force and turning effect satisfy equilibrium conditions.',example:'Two equal opposite collinear forces can balance translational motion.'},
'11|Physics|Work and Energy':{fact:'Work transfers energy when a force causes displacement, and energy is measured in joules.',example:'For a constant force parallel to displacement, W = Fd.'},
'11|Statistics|Descriptive Statistics':{fact:'Descriptive statistics summarize data using measures such as mean, median, mode and measures of spread.',example:'The median of 2, 5, 7, 9 and 12 is 7.'},
'11|Urdu|قواعد':{fact:'اعلیٰ جماعت کی اردو قواعد میں جملے کی ساخت، درست الفاظ، فعل و ضمیر اور زبان کے باقاعدہ استعمال پر توجہ دی جاتی ہے۔',example:'جملے میں فعل اور فاعل کی درست مطابقت معنی کو واضح کرتی ہے۔'},

'12|Biology|Genetics':{fact:'Genetics studies heredity, genes, chromosomes and the transmission of biological information between generations.',example:'Different alleles of a gene can contribute to variation in a trait.'},
'12|Chemistry|Organic Chemistry':{fact:'Organic chemistry studies carbon compounds, their functional groups, structures and reactions.',example:'Alcohols contain a hydroxyl functional group, while carboxylic acids contain a carboxyl group.'},
'12|Computer Science|Databases':{fact:'Database systems organize related data and use keys, queries and relationships to manage information efficiently.',example:'A foreign key can connect records in one table with a primary key in another.'},
'12|English|Writing Skills':{fact:'Effective writing organizes ideas clearly, uses evidence and transitions, and maintains accurate grammar and tone.',example:'A strong paragraph usually has a clear topic sentence followed by supporting details.'},
'12|Mathematics|Differentiation':{fact:'Differentiation measures instantaneous rate of change and gives the slope of a curve at a point.',example:'d(x²)/dx = 2x.'},
'12|Mathematics|Integration':{fact:'Integration can represent accumulation and can be used to recover antiderivatives or calculate areas.',example:'An antiderivative of 2x is x² + C.'},
'12|Pakistan Studies|Geography and Resources':{fact:'Geography and resources studies Pakistan’s physical regions, water, minerals, agriculture, population and their economic importance.',example:'Water resources support agriculture, households, industry and power generation.'},
'12|Physics|Current Electricity':{fact:'Current electricity relates charge flow, potential difference, resistance, power and circuit behaviour.',example:'Electrical power can be calculated from P = VI.'},
'12|Physics|Electromagnetic Induction':{fact:'Electromagnetic induction produces an emf when magnetic flux through a circuit changes.',example:'Faraday’s law can be written as ε = −N dΦ/dt.'},
'12|Physics|Electrostatics':{fact:'Electrostatics studies electric charges at rest, electric force, field and potential.',example:'Coulomb’s force varies inversely with the square of the separation between point charges.'},
'12|Statistics|Probability':{fact:'Probability assigns values from 0 to 1 to events and follows rules for complements, unions and intersections.',example:'If P(A) = 0.3, then P(Aᶜ) = 0.7.'},
'12|Urdu|قواعد':{fact:'اردو قواعد میں درست جملہ سازی، لفظی ربط اور زبان کے قواعد کے مطابق اظہار پر توجہ دی جاتی ہے۔',example:'درست ضمیر اور فعل کا استعمال جملے کے معنی کو واضح اور درست بناتا ہے۔'}
};

const slug=v=>String(v||'').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,42)||'topic';
const questions=PD.questions=Array.isArray(PD.questions)?PD.questions:[];
const existing=new Set(questions.map(x=>x.id));
const byKey=new Map();
for(const q of questions){
  const k=[q.classLevel,q.subject,q.chapter].join('|');
  if(!byKey.has(k))byKey.set(k,[]);
  byKey.get(k).push(q);
}
const generic=[
  'It is only a memorization exercise with no concepts or examples.',
  'It is unrelated to the subject and does not use rules, evidence or reasoning.',
  'It means every problem can be solved without checking definitions, data or conditions.'
];

function add(q){
  if(existing.has(q.id))return;
  questions.push(q);existing.add(q.id);
  const k=[q.classLevel,q.subject,q.chapter].join('|');
  if(!byKey.has(k))byKey.set(k,[]);
  byKey.get(k).push(q);
}
function siblingFacts(cl,subject,chapter){
  const out=[];
  for(const [k,v] of Object.entries(B)){
    const [c,s,ch]=k.split('|');
    if(c===String(cl)&&s===subject&&ch!==chapter)out.push(v.fact);
  }
  return out;
}

for(const [cl,subjects] of Object.entries(PD.subjects||{})){
  for(const subject of subjects||[]){
    for(const chapter of (PD.chapters?.[cl+'|'+subject]||[])){
      const key=cl+'|'+subject+'|'+chapter;
      const bp=B[key];
      if(!bp)continue;
      const rows=byKey.get(key)||[];
      const prefix='pc-'+cl+'-'+slug(subject)+'-'+slug(chapter);
      if(!rows.some(x=>x.type==='mcq')){
        const distractors=[...siblingFacts(cl,subject,chapter),...generic].filter(x=>x!==bp.fact).slice(0,3);
        while(distractors.length<3)distractors.push(generic[distractors.length%generic.length]);
        const options=[bp.fact,...distractors];
        add({id:prefix+'-mcq',classLevel:Number(cl),subject,chapter,type:'mcq',difficulty:'Easy',question:'Which statement best matches the topic “'+chapter+'”?',options,answer:0,explanation:bp.fact});
      }
      if(!rows.some(x=>x.type==='short')){
        add({id:prefix+'-short',classLevel:Number(cl),subject,chapter,type:'short',difficulty:'Medium',question:'State one key idea from “'+chapter+'” and give a simple supporting example.',answerText:bp.fact+' Example: '+bp.example});
      }
      if(!rows.some(x=>x.type==='long')){
        add({id:prefix+'-long',classLevel:Number(cl),subject,chapter,type:'long',difficulty:'Hard',question:'Explain the central idea of “'+chapter+'” in your own words. Include one correct example, application or supporting detail.',answerText:'A strong answer should explain this idea: '+bp.fact+' A suitable example/application is: '+bp.example});
      }
    }
  }
}

PD.completionStandard={
  updatedAt:'2026-10-01',
  minimumPerChapter:3,
  requiredTypes:['mcq','short','long'],
  requiredDifficulties:['Easy','Medium','Hard'],
  note:'Every visible Practice chapter is backed by MCQ, short-answer and long-answer practice. Existing curriculum-specific questions are retained; missing practice types are filled with EduNizam built-in concept questions.'
};
window.EDUNIZAM_PRACTICE_BLUEPRINTS=B;
})();