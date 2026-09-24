"use client";

import { Activity, Building2, ExternalLink, MapPin } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import {
  BOSS_JOB_SAMPLES,
  CHINA_CITY_MARKET_SNAPSHOT,
  CHINA_JOB_PORTALS,
  CHINA_MARKET_SNAPSHOT_DATE,
  CHINA_MARKET_SOURCES,
} from "@/data/chinaMarket";

export default function ChinaMarketSnapshot() {
  const { locale } = useLanguage();
  const zh = locale === "zh";

  return (
    <section className="card mb-10 animate-fade-up-delay-1" style={{ padding: "28px" }}>
      <div className="flex items-start justify-between gap-4 flex-wrap" style={{ marginBottom: "22px" }}>
        <div>
          <div className="flex items-center gap-2" style={{ color: "var(--accent-emerald)", marginBottom: "8px" }}>
            <Activity size={16} />
            <span className="text-label">{zh ? "可核验的中国就业市场快照" : "Verified China employment market snapshot"}</span>
          </div>
          <h2 className="text-h2" style={{ color: "var(--fg-primary)" }}>
            {zh ? "全国就业与重点城市人才流动" : "National employment and major-city talent flows"}
          </h2>
          <p style={{ color: "var(--fg-secondary)", fontSize: "0.84rem", marginTop: "8px", lineHeight: 1.7 }}>
            {zh
              ? "以下内容是最新公开资料快照，不冒充实时岗位数。不同统计指标口径不同，不能直接相互换算。"
              : "This is a snapshot of the latest public releases, not a live job-count feed. Metrics use different methodologies and are not directly comparable."}
          </p>
        </div>
        <span className="badge badge-brand">
          {zh ? `核验日期：${CHINA_MARKET_SNAPSHOT_DATE}` : `Checked: ${CHINA_MARKET_SNAPSHOT_DATE}`}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" style={{ marginBottom: "24px" }}>
        {[
          { value: "1,267 万人", en: "12.67 million", labelZh: "2025年全国城镇新增就业", labelEn: "New urban jobs in 2025" },
          { value: "5.2%", en: "5.2%", labelZh: "2025年城镇调查失业率均值", labelEn: "Average surveyed urban unemployment in 2025" },
          { value: "155,491 元/年", en: "CNY 155,491/year", labelZh: "2025年规模以上企业专业技术人员平均工资", labelEn: "Average wage of professional/technical staff at above-designated-size enterprises in 2025" },
        ].map((item) => (
          <div key={item.labelZh} style={{ padding: "18px", borderRadius: "16px", background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.16)" }}>
            <div style={{ color: "var(--accent-emerald)", fontSize: "1.35rem", fontWeight: 800 }}>{zh ? item.value : item.en}</div>
            <div style={{ color: "var(--fg-secondary)", fontSize: "0.75rem", lineHeight: 1.5, marginTop: "6px" }}>{zh ? item.labelZh : item.labelEn}</div>
          </div>
        ))}
      </div>

      <div style={{ overflowX: "auto", marginBottom: "24px" }}>
        <div className="flex items-center gap-2" style={{ marginBottom: "12px", color: "var(--fg-primary)", fontWeight: 750 }}>
          <MapPin size={17} color="#06b6d4" />
          {zh ? "中国重点城市公开指标" : "Public indicators for major Chinese cities"}
        </div>
        <table style={{ width: "100%", minWidth: "860px", borderCollapse: "collapse", fontSize: "0.82rem" }}>
          <thead>
            <tr style={{ color: "var(--fg-muted)", textAlign: "left", borderBottom: "1px solid var(--border-default)" }}>
              <th style={{ padding: "10px 12px" }}>{zh ? "城市" : "City"}</th>
              <th style={{ padding: "10px 12px" }}>{zh ? "2025年人才吸引力名次" : "2025 talent-attraction rank"}</th>
              <th style={{ padding: "10px 12px" }}>{zh ? "2025年第四季度新一代信息技术职位占比" : "Share of next-generation IT postings, 2025 Q4"}</th>
              <th style={{ padding: "10px 12px" }}>{zh ? "2025年新质人才平均招聘月薪" : "Average monthly recruiting salary for new-quality talent, 2025"}</th>
            </tr>
          </thead>
          <tbody>
            {CHINA_CITY_MARKET_SNAPSHOT.map((row) => (
              <tr key={row.city} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", color: "var(--fg-secondary)" }}>
                <td style={{ padding: "11px 12px", color: "var(--fg-primary)", fontWeight: 700 }}>{row.city}</td>
                <td style={{ padding: "11px 12px" }}>{zh ? `第 ${row.attractionRank} 名` : `No. ${row.attractionRank}`}</td>
                <td style={{ padding: "11px 12px" }}>{row.itDemandShare ?? (zh ? "公开摘要未披露" : "Not disclosed in public summary")}</td>
                <td style={{ padding: "11px 12px" }}>{row.newQualityMonthlySalary ? `${row.newQualityMonthlySalary.toLocaleString("zh-CN")} 元/月` : (zh ? "公开摘要未披露" : "Not disclosed in public summary")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ color: "var(--fg-muted)", fontSize: "0.72rem", lineHeight: 1.6, marginTop: "10px" }}>
          {zh
            ? "说明：人才吸引力名次覆盖全部流动人才；职位占比仅指新一代信息技术岗位；月薪仅指新质人才招聘。三列口径不同，空缺处不作推算。"
            : "Note: attraction rank covers all mobile talent; posting share covers next-generation IT roles; salary covers new-quality talent recruiting. These are separate metrics, and missing values are not estimated."}
        </p>
      </div>

      <div>
        <div className="flex items-center gap-2" style={{ marginBottom: "12px", color: "var(--fg-primary)", fontWeight: 750 }}>
          <Building2 size={17} color="#a855f7" />
          {zh ? "数据来源与发布日期" : "Sources and publication dates"}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {CHINA_MARKET_SOURCES.map((source) => (
            <a
              key={source.id}
              href={source.url}
              target="_blank"
              rel="noreferrer"
              style={{ padding: "14px 16px", borderRadius: "14px", border: "1px solid var(--border-default)", background: "var(--bg-surface)", textDecoration: "none" }}
            >
              <div className="flex items-start gap-2">
                <ExternalLink size={13} color="#06b6d4" style={{ marginTop: "3px", flexShrink: 0 }} />
                <div>
                  <div style={{ color: "var(--fg-primary)", fontSize: "0.78rem", fontWeight: 700, lineHeight: 1.5 }}>{zh ? source.titleZh : source.titleEn}</div>
                  <div style={{ color: "var(--fg-muted)", fontSize: "0.7rem", marginTop: "4px" }}>
                    {zh ? source.publisherZh : source.publisherEn} · {source.published.includes("核验")
                      ? (zh ? source.published : `Checked ${source.published.split(" ")[0]}`)
                      : `${zh ? "发布于" : "Published"} ${source.published}`}
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>

      <div style={{ marginTop: "24px" }}>
        <div className="flex items-center gap-2" style={{ marginBottom: "12px", color: "var(--fg-primary)", fontWeight: 750 }}>
          <Building2 size={17} color="#f59e0b" />
          {zh ? "公开职位薪资样本" : "Public job-posting salary samples"}
        </div>
        <p style={{ color: "var(--fg-muted)", fontSize: "0.74rem", lineHeight: 1.6, marginBottom: "12px" }}>
          {zh
            ? "样本来自直聘招聘平台的北京软件开发职位页，核验于 2026-09-23。它们是不同经验和学历要求的单个职位，不代表城市平均薪资，也不用于推算薪资范围。"
            : "Samples are from a BOSS Zhipin Beijing software-development listing page, checked on 2026-09-23. They are individual roles with different requirements, not a city average and not used to estimate a range."}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {BOSS_JOB_SAMPLES.map((job, index) => (
            <div key={`${job.title}-${index}`} style={{ padding: "14px 16px", borderRadius: "14px", border: "1px solid rgba(245,158,11,0.18)", background: "rgba(245,158,11,0.04)" }}>
              <div style={{ color: "var(--fg-primary)", fontSize: "0.8rem", fontWeight: 750 }}>{job.title}</div>
              <div style={{ color: "#fbbf24", fontSize: "0.86rem", fontWeight: 800, marginTop: "5px" }}>{job.salary}</div>
              <div style={{ color: "var(--fg-muted)", fontSize: "0.7rem", marginTop: "4px" }}>{job.experience} · {job.education}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: "24px" }}>
        <div className="flex items-center gap-2" style={{ marginBottom: "12px", color: "var(--fg-primary)", fontWeight: 750 }}>
          <ExternalLink size={17} color="#06b6d4" />
          {zh ? "实时招聘入口" : "Live recruitment portals"}
        </div>
        <div className="flex flex-wrap gap-3">
          {CHINA_JOB_PORTALS.map((portal) => (
            <a key={portal.url} href={portal.url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
              <ExternalLink size={13} /> {zh ? portal.labelZh : portal.labelEn}
            </a>
          ))}
        </div>
        <p style={{ color: "var(--fg-muted)", fontSize: "0.7rem", lineHeight: 1.6, marginTop: "10px" }}>
          {zh
            ? "招聘平台职位会持续变化，且部分详情需要登录或受访问限制，因此本站只提供可点击入口和核验样本，不展示无法稳定复核的所谓“实时岗位总数”。"
            : "Listings change continuously and some details require sign-in or restrict automated access, so this site provides verified samples and direct links instead of an unverifiable ‘live total’."}
        </p>
      </div>
    </section>
  );
}
