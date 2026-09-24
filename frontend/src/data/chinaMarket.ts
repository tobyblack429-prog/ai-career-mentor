export const CHINA_MARKET_LOCATIONS = [
  "Beijing, China",
  "Shanghai, China",
  "Shenzhen, China",
  "Hangzhou, China",
  "Guangzhou, China",
  "Suzhou, China",
  "Chengdu, China",
  "Nanjing, China",
  "Wuhan, China",
  "Wuxi, China",
] as const;

export const CHINA_CITY_LABELS: Record<string, string> = {
  "Beijing, China": "北京",
  "Shanghai, China": "上海",
  "Shenzhen, China": "深圳",
  "Hangzhou, China": "杭州",
  "Guangzhou, China": "广州",
  "Suzhou, China": "苏州",
  "Chengdu, China": "成都",
  "Nanjing, China": "南京",
  "Wuhan, China": "武汉",
  "Wuxi, China": "无锡",
};

export const CHINA_MARKET_SOURCES = [
  {
    id: "national-employment-2025",
    titleZh: "国家统计局：中华人民共和国2025年国民经济和社会发展统计公报",
    titleEn: "National Bureau of Statistics: 2025 Statistical Communique",
    publisherZh: "国家统计局",
    publisherEn: "National Bureau of Statistics",
    published: "2026-02-28",
    url: "https://www.stats.gov.cn/sj/zxfb/202602/t20260228_1962662.html",
  },
  {
    id: "national-wages-2025",
    titleZh: "国家统计局：2025年城镇单位就业人员年平均工资情况",
    titleEn: "National Bureau of Statistics: 2025 Urban Wage Statistics",
    publisherZh: "国家统计局",
    publisherEn: "National Bureau of Statistics",
    published: "2026-05-15",
    url: "https://www.stats.gov.cn/sj/zxfb/202605/t20260515_1963707.html",
  },
  {
    id: "city-attraction-2025",
    titleZh: "2025年中国城市人才吸引力排名（智联招聘报告公开摘要）",
    titleEn: "2025 China City Talent Attraction Ranking",
    publisherZh: "杭州宣传网",
    publisherEn: "Hangzhou Publicity Network",
    published: "2026-05-27",
    url: "https://www.hzxcw.gov.cn/content_47931.html",
  },
  {
    id: "new-it-demand-2025q4",
    titleZh: "2025年第四季度新一代信息技术人才需求城市分布",
    titleEn: "2025 Q4 Next-generation IT Talent Demand by City",
    publisherZh: "杭州日报",
    publisherEn: "Hangzhou Daily",
    published: "2026-01-29",
    url: "https://mdaily.hangzhou.com.cn/hzrb/2026/01/29/article_detail_1_20260129A098.html",
  },
  {
    id: "new-quality-talent-2025",
    titleZh: "2025中国城市新质人才竞争力指数报告公开摘要",
    titleEn: "2025 China New-quality Talent Competitiveness Index",
    publisherZh: "深圳市人民政府",
    publisherEn: "Shenzhen Municipal Government",
    published: "2026-07-09",
    url: "https://www.sz.gov.cn/cn/xxgk/zfxxgj/zwdt/content/post_12884592.html",
  },
  {
    id: "boss-beijing-software-jobs",
    titleZh: "北京初级软件开发工程师公开职位样本页",
    titleEn: "Public Beijing junior software developer listings",
    publisherZh: "直聘招聘平台",
    publisherEn: "BOSS Zhipin",
    published: "2026-09-23 核验",
    url: "https://www.zhipin.com/zhaopin/ca91ad4f992d4d1e0nB_3t-6GA~~/",
  },
  {
    id: "guopin-2026-events",
    titleZh: "2026年国聘招聘会与人工智能、信息技术专场",
    titleEn: "2026 Guopin job fairs and AI/IT events",
    publisherZh: "国聘网",
    publisherEn: "Guopin",
    published: "2026-09-23 核验",
    url: "https://zph.iguopin.com/",
  },
] as const;

export const BOSS_JOB_SAMPLES = [
  { title: "Java 软件开发工程师（初级、中级、高级）", salary: "1.2–2.4 万元/月", experience: "经验不限", education: "本科" },
  { title: "软件开发工程师", salary: "1.1–2.2 万元/月", experience: "在校或应届", education: "本科" },
  { title: "软件开发工程师", salary: "1.8–2.5 万元/月", experience: "3–5 年", education: "本科" },
  { title: "软件开发工程师", salary: "2–4 万元/月，14 薪", experience: "3–5 年", education: "本科" },
] as const;

export const CHINA_JOB_PORTALS = [
  { labelZh: "直聘招聘平台 · 北京招聘", labelEn: "BOSS Zhipin · Beijing jobs", url: "https://www.zhipin.com/beijing/" },
  { labelZh: "国聘网 · 2026 招聘会", labelEn: "Guopin · 2026 job fairs", url: "https://zph.iguopin.com/" },
  { labelZh: "国聘网 · 智能制造与数字科技专场", labelEn: "Guopin · Smart manufacturing and digital technology", url: "https://sjzn2026.iguopin.com/" },
] as const;

export const CHINA_CITY_MARKET_SNAPSHOT = [
  { city: "北京", attractionRank: 1, itDemandShare: "8.7%", newQualityMonthlySalary: 17095 },
  { city: "上海", attractionRank: 2, itDemandShare: "4.6%", newQualityMonthlySalary: 16910 },
  { city: "深圳", attractionRank: 3, itDemandShare: "7.6%", newQualityMonthlySalary: 15975 },
  { city: "杭州", attractionRank: 4, itDemandShare: "5.7%", newQualityMonthlySalary: null },
  { city: "广州", attractionRank: 5, itDemandShare: null, newQualityMonthlySalary: null },
  { city: "苏州", attractionRank: 6, itDemandShare: null, newQualityMonthlySalary: null },
  { city: "成都", attractionRank: 7, itDemandShare: "4.4%", newQualityMonthlySalary: null },
  { city: "南京", attractionRank: 8, itDemandShare: null, newQualityMonthlySalary: null },
  { city: "武汉", attractionRank: 9, itDemandShare: null, newQualityMonthlySalary: null },
  { city: "无锡", attractionRank: 10, itDemandShare: null, newQualityMonthlySalary: null },
] as const;

export const CHINA_MARKET_SNAPSHOT_DATE = "2026-09-23";
