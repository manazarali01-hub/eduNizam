(function(){
'use strict';
const OFFICIAL_CATEGORIES=new Set([
  'Accounting, Banking & Finance','Bioinformatics','Biotechnology',
  'Computer Science/Information Technology','Economics','English',
  'Humanities Distribution','Law','Management','Marketing','Mass Communication',
  'Mathematics','Molecular Biology','Physics','Power System',
  'Probability & Statistics','Psychology','Sociology','Zoology'
]);
const CATEGORY_ALIASES={
  'Humanities Distribution / Education':'Humanities Distribution',
  'Mathematics / Statistics':'Mathematics',
  'Mass Communication / English':'Mass Communication'
};
const canonicalCategory=course=>{
  const raw=String(course?.category||'').trim();
  const aliased=CATEGORY_ALIASES[raw]||raw;
  return OFFICIAL_CATEGORIES.has(aliased)?aliased:'';
};
const codeOf=course=>String(course?.code||'').trim().toUpperCase();
const queryUrl=course=>'https://ocw.vu.edu.pk/Courses.aspx?q='+encodeURIComponent(codeOf(course));
const route=(page,course)=>{
  const code=codeOf(course),cat=canonicalCategory(course);
  if(!code||!cat)return queryUrl(course);
  return 'https://ocw.vu.edu.pk/'+page+'.aspx?cat='+encodeURIComponent(cat)+'&course='+encodeURIComponent(code);
};
function forCourse(course){
  const code=codeOf(course),cat=canonicalCategory(course);
  if(!code)return null;
  const direct=!!cat;
  return {
    code,category:cat||String(course?.category||''),
    direct,
    search:queryUrl(course),
    details:direct?route('CourseDetails',course):queryUrl(course),
    overview:direct?route('CourseOverview',course):queryUrl(course),
    videos:direct?route('Videos',course):queryUrl(course),
    notes:direct?route('Notes',course):queryUrl(course),
    references:direct?route('ReferenceBooks',course):queryUrl(course),
    assignments:direct?route('Assignments',course):queryUrl(course),
    links:direct?route('Links',course):queryUrl(course),
    grading:direct?route('GradingScheme',course):queryUrl(course),
    catalogue:'https://ocw.vu.edu.pk/Courses.aspx',
    vulms:'https://vulms.vu.edu.pk/'
  };
}
function enrichCatalogue(catalogue){
  const rows=Array.isArray(catalogue?.courses)?catalogue.courses:[];
  rows.forEach(course=>{
    const p=forCourse(course);if(!p)return;
    course.officialSearch=p.search;
    if(p.direct){
      course.officialDetails=course.officialDetails||p.details;
      course.officialOverview=course.officialOverview||p.overview;
      course.officialVideos=course.officialVideos||p.videos;
      course.officialNotes=course.officialNotes||p.notes;
      course.officialReferences=course.officialReferences||p.references;
      course.officialAssignments=course.officialAssignments||p.assignments;
      course.officialLinks=course.officialLinks||p.links;
      course.officialGrading=course.officialGrading||p.grading;
      course.officialCategory=p.category;
    }
  });
  return catalogue;
}
window.EDUNIZAM_VU_PATHWAYS={officialCategories:[...OFFICIAL_CATEGORIES],canonicalCategory,forCourse,enrichCatalogue};
if(window.EDUNIZAM_VU_COURSE_CATALOG)enrichCatalogue(window.EDUNIZAM_VU_COURSE_CATALOG);
})();