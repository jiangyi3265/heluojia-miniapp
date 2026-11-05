// Editorial content for the separate skincare discovery experience.
// Describes customer preferences and the existing catalog, never a diagnosis.
export const SKINCARE_CATEGORIES = [
 {id:'water',label:'精华水',icon:'drop',codes:['HLJ-TONER']},
 {id:'emulsion',label:'凝润乳',icon:'bottle',codes:['HLJ-EMULSION']},
 {id:'cream',label:'面霜',icon:'care',codes:['HLJ-CLEAR-CREAM','HLJ-GENTLE-CREAM','HLJ-RICH-CREAM','HLJ-RENEW-CREAM']},
 {id:'oil',label:'精华油',icon:'spark',codes:['HLJ-FACIAL-OIL']}
]
export function skincareCatalog(products) {
 const codes=SKINCARE_CATEGORIES.flatMap(c=>c.codes)
 return (Array.isArray(products)?products:[]).filter(p=>p&&codes.includes(p.product_code)&&![false,0,'0'].includes(p.enabled)&&![false,0,'0'].includes(p.retail_enabled)&&Number(p.archived||0)===0&&p.price!=null&&Number.isFinite(Number(p.price))&&Number(p.price)>=0)
  .sort((a,b)=>codes.indexOf(a.product_code)-codes.indexOf(b.product_code))
}
export const SKINCARE_GUIDES = {
 hydrate:{title:'把水润，放进日常',subtitle:'从喜欢的质地开始',image:'hero',keywords:['精华水','乳液','保湿面霜'],intro:'你选择了补水保湿。可以先认识水、乳、霜三类单品，再按日常肤感决定自己的搭配。',texture:'精华水、凝润乳和面霜的使用感各有不同。你可以先查看商品介绍，挑选平时愿意使用的质地。',routine:'护理不必一步到位。已经有喜欢的产品时，可以先了解缺少的那一类，再决定是否搭配同系列单品。',more:'这份清单根据你的选择整理。先选需要的产品，再参照各自包装上的用法与用量，找到方便坚持的日常。'},
 light:{title:'喜欢清爽，也喜欢自在',subtitle:'认识清润款面霜',image:'hero-creams',keywords:['清润','按需取用','轻松日常'],intro:'你更关注清爽的使用感。臻颜新肌系列有清润、中润、倍润三种选择，可以从清润款开始了解。',texture:'清透霜是系列中的清润款。若想比较不同润泽感，也可以一起查看柔护霜和奢润霜。',routine:'结合自己已经在使用的单品挑选，不必为了完成一套流程而增加产品。',more:'季节、环境和个人喜好会改变对质地的感受。下次偏好变化时，可以重新填写问卷，查看其他可选搭配。'},
 soft:{title:'为日常，留一份柔润',subtitle:'找到用起来舒服的质地',image:'hero-creams',keywords:['柔润','日常保湿','个人肤感'],intro:'你更在意柔润的使用体验。可以从凝润乳与面霜中，了解自己喜欢的润泽程度。',texture:'柔护霜为中润款，系列同时提供清润与倍润。三种质地是供你比较的选择。',routine:'从自己的日常习惯出发，保留喜欢的产品，再了解想补充的单品。',more:'名称和质地用于帮助选购，实际使用感因人而异。产品的具体用法和注意事项请查看包装。'},
 daily:{title:'让护肤，成为熟悉的日常',subtitle:'简单有序，慢慢找到习惯',image:'hero',keywords:['水类护理','乳霜搭配','按需选择'],intro:'你选择了日常维养。我们为你整理常见的水、乳、霜单品，方便一次看清系列中的选择。',texture:'面霜可按清润、中润、倍润比较；乳液与精华水可以结合原有习惯了解。',routine:'选择能融入日常的单品组合，比一次增加很多步骤更容易安排。',more:'清单里的产品都可以单独了解和选购，不需要整套购买。实际使用方式以每款包装说明为准。'},
 radiance:{title:'一点润泽，一点光采',subtitle:'了解精华油的搭配选择',image:'hero',keywords:['面部护理油','滴管取用','按需搭配'],intro:'你关注润泽光采。除了水、乳与面霜，也可以了解新肌臻萃油这款面部护理油。',texture:'臻萃油采用滴管包装。可以先查看产品介绍，了解它与乳霜类产品的不同。',routine:'如果已经有完整的护理习惯，可以单独了解油类产品，决定是否需要加入自己的日常。',more:'不同单品的使用方式可能不同。取用量、搭配与使用顺序请以包装说明为准，也可以在咨询时请客服说明。'},
 simple:{title:'少一点步骤，多一点从容',subtitle:'先从需要的单品开始',image:'hero',keywords:['精华水','一款面霜','精简选择'],intro:'你选择了精简护肤。这份方案会优先展示精华水与一款面霜，便于集中比较。',texture:'先根据日常肤感选择面霜润泽程度，再了解精华水是否符合自己的使用习惯。',routine:'保留正在使用且喜欢的单品，不必一次更换整套产品。',more:'精简方案只是选购参考，并不要求同时使用所有推荐产品。之后想了解其他单品时，也可以到产品页自由浏览。'},
 makeup:{title:'从容打底，开启一天',subtitle:'把护理放进你的妆前习惯',image:'hero',keywords:['凝润乳','个人习惯','质地选择'],intro:'你选择了妆前打底。可以先了解凝润乳，再结合已有的彩妆与护理习惯挑选。',texture:'水类、乳类和面霜的质地不同。可以先从平时喜欢的使用感出发。',routine:'护肤与后续彩妆的搭配体验因人而异，选购时可以向客服说明自己关注的使用场景。',more:'这份方案根据你填写的场景推荐可了解的单品，不对具体底妆效果作保证。具体用法以产品说明为准。'},
 season:{title:'季节在变，偏好也可以变',subtitle:'重新认识自己的润泽选择',image:'hero-creams',keywords:['清润','中润','倍润'],intro:'你关注换季护理。臻颜新肌三款面霜提供不同润泽选择，方便按当下的喜好重新比较。',texture:'清透霜为清润，柔护霜为中润，奢润霜为倍润。可以在产品页切换查看。',routine:'不必因为换季就更换所有单品。先想清楚想调整的质地，再选择需要了解的产品。',more:'如果偏好改变，重新填写即可生成新的本机方案。现有商品、价格和库存以商城页面为准。'},
 night:{title:'夜色渐柔，留一点时间给自己',subtitle:'认识你的晚间护理选择',image:'hero',keywords:['晚间日常','润泽质地','按需搭配'],intro:'你选择了夜间滋养。可以了解润泽类面霜与面部护理油，再决定适合自己的晚间搭配。',texture:'偏好更润泽的质地时，可以先查看倍润款面霜，也可以比较中润款。',routine:'为喜欢的护理习惯留一点时间。每款产品的使用顺序和用量，按包装说明安排即可。',more:'清单提供可选单品，不代表需要一次全部叠加。已经有在用产品时，可以在咨询中说明自己的搭配需求。'}
}
export const SKINCARE_FAQS = [
 {question:'清润、中润、倍润怎么选择？',answer:'清透霜、柔护霜、奢润霜对应三种润泽选择。可以从自己平时喜欢的肤感出发，打开商品页比较；不确定时也可以咨询商城客服。'},
 {question:'需要整套购买吗？',answer:'不用。方案中的商品可以单独了解和选购。你可以保留已有的护理产品，只选择需要补充的单品。'},
 {question:'产品体验怎么安排？',answer:'留下联系方式和护理偏好后，商城客服会与你沟通当前的体验活动。是否提供体验、具体费用和库存，以客服确认的信息为准。'}
]
