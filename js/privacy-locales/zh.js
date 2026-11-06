export default {
  "title": "隐私，不绕弯。",
  "intro": [
    "我们不想要你的数据。",
    "访问变成匿名总数，不用追踪 cookie。",
    "少量保存的信息（例如投票或登录码）列在下方，都有期限。"
  ],
  "updated": "2026-11-06",
  "sections": [
    [
      "who",
      "谁提着这盏灯？",
      "Francisco Gabriel Van Langenhove 负责 corvus.gent 和 stats.corvus.gent，包括音乐与游戏。问题或数据请求请联系：<a href=\"mailto:gabriel@corvus.gent\">gabriel@corvus.gent</a>。"
    ],
    [
      "counts",
      "统计什么",
      "默认由 PostHog EU 统计访问和允许的操作，不用 cookie、浏览器存储、个人档案或录屏。它会用网络及浏览器信息生成临时的每日化名；只有汇总结果是匿名的。不采集姓名、邮箱或表单内容。GPC、DNT 或‘别统计我’会阻止加载 PostHog，只增加页面和日期计数，不保存 ID、哈希或请求头。这些访问次数不是独立人数。"
    ],
    [
      "why",
      "用途与法律依据",
      "基础无 cookie 统计与防滥用以合法利益为声明依据。Spotify 需要你点击播放。登录邮件、投票和预约用于完成你的请求。可在这里反对 PostHog 统计，之后仅保留匿名访问次数。不出售数据。"
    ],
    [
      "storage",
      "保存多久",
      "登录码：3 分钟。会话：7 天或直到退出。登录记录、访问申请及与邮箱关联的访客数竞猜：最多 90 天。防滥用记录：最多 24 小时，每天更换加盐 IP 哈希；我们的应用不保存原始 IP。机器人验证：5 分钟。服务器游戏历史：使用后 48 小时；连续游戏记录及防重复投票：最多一年。匿名总数和公开歌曲建议可保留至删除。",
      "分析事件的期限由 PostHog 项目设置决定；目标是 90 天，但该账户设置仍待确认。托管和邮件服务商的日志及备份有自己的期限。可联系我了解当前详情。",
      "Resend：美国存储；Free/Pro/Scale 邮件和日志保存 30 天，备份 7 天；Enterprise 可能不同。 <a href=\"https://resend.com/security/gdpr/\" rel=\"noreferrer\">Resend GDPR</a>."
    ],
    [
      "sf",
      "旧金山行程留言",
      "提交 sf 表单后，只有 gabe 能在私人面板中查看你的姓名、联系方式、工作、活动、日期、地点和留言。这些信息用于安排你请求的见面，不用于营销。每条记录在提交 60 天后自动从 Redis 删除；标记完成不会延长保存时间。",
      "副本会通过 Resend 发到 gabriel@corvus.gent，属于本页说明的美国存储例外。Resend 有自己的发送日志保存期限；gabe 必须在同样的 60 天内删除邮箱中的通知。你可以要求提前删除，即使用的是 x 用户名或 linkedin 主页。",
      "签名的 vid cookie 也用于防止表单滥用；验证挑战在 5 分钟后失效，ip 哈希每天变化并在一天内到期，重试凭证在 24 小时后到期。首页纸条用 sessionStorage（sf-note:2026-11）保证每个标签页会话只出现一次。可选统计只记录操作次数，不记录表单内容。"
    ],
    [
      "browser",
      "浏览器里的少量信息",
      "必要 cookie：sess 保持登录；vid 防止语言投票重复；mvid 保存音乐投票和每日游戏进度。它们经过签名、安全传输，页面脚本无法读取。sess 在 7 天后过期，vid 和 mvid 在一年后过期。它们从不用于分析身份识别。",
      "只用一个本地 privacy-choice 标记记住‘ok’或‘别统计我’。点击‘ok’每个浏览器及网站源计一次 soldier；清除网站数据后可能再次计数。此标记不会发送给 PostHog。分析和活动标签仅留在内存，不用浏览器存储。"
    ],
    [
      "outside",
      "其他服务何时参与",
      "只有点击播放后，Spotify 才收到播放请求，并可能设置自己的 cookie。你提交歌曲链接时，我们的服务器才向 Spotify 或 Apple 查询。CARTO 地图图块通过我们的服务器提供，不转发你的 IP。Leaflet、Sortable 和 PostHog 程序库均由本站托管。",
      "Buy Me a Coffee 和 Pidgy 预约都是链接，不是嵌入式表单。点击后适用各自的隐私政策。/links、/go 及推广短链接只添加 UTM 推广标签并统计访问和点击，不采集表单内容或访客身份。",
      "Notion 保存我手动录入的 X 记录。公开统计只显示汇总、公开的活动和语气标签，以及我自己的帖子；回复内容和目标网址仅登录后可见。获准的活动标签和地区小时段用于可选分析。Corvus 副本在 24 小时内过期，源记录遵循我的 Notion 保留规则。工作区区域仍待确认，因此不承诺仅在欧盟存储。",
      "为了统计咖啡杯数，服务器会短暂读取 Buy Me a Coffee 的记录，并在有账号或邮箱时识别重复支持者。只缓存总数和最近一次收到咖啡的日期，时长为 30 分钟。",
      "默认由 PostHog EU 统计访问和允许的操作，不用 cookie、浏览器存储、个人档案或录屏。它会用网络及浏览器信息生成临时的每日化名；只有汇总结果是匿名的。不采集姓名、邮箱或表单内容。GPC、DNT 或‘别统计我’会阻止加载 PostHog，只增加页面和日期计数，不保存 ID、哈希或请求头。这些访问次数不是独立人数。"
    ],
    [
      "where",
      "数据会去哪里",
      "我们的 Vercel 函数配置在法兰克福（fra1）。静态文件和请求路由使用全球网络。PostHog EU 位于法兰克福。Redis 的迁移目标也是法兰克福；当前数据库区域和迁移结果仍需核实。",
      "Resend 暂时保留为例外：计划从爱尔兰发送邮件，仍待核实账户设置，但邮件内容和日志存储在美国。从爱尔兰发送并不会改变存储地点。<a href=\"https://resend.com/docs/dashboard/domains/regions\" rel=\"noreferrer\">Resend</a>。",
      "Vercel 是美国公司。其 <a href=\"https://vercel.com/legal/dpa\" rel=\"noreferrer\">Vercel DPA</a> 和 <a href=\"https://vercel.com/security\" rel=\"noreferrer\">EU–US Data Privacy Framework</a> 为跨境传输提供保障，但不代表所有供应商日志、支持访问或备份都留在欧盟。我们仍需确认账户设置和适用协议。"
    ],
    [
      "rights",
      "你的权利",
      "你可以通过邮件请求访问、更正、删除、限制处理或转移数据，也可以反对基于合法利益的处理。关闭播放器或页面即可撤回播放同意；已设置的 cookie 由 Spotify 管理。我们通常在一个月内回复。可能需要合理证据确认请求涉及你的数据；匿名汇总无法追溯到个人。",
      "你也可以向比利时数据保护机构投诉：<a href=\"https://www.gegevensbeschermingsautoriteit.be/\" rel=\"noreferrer\">gegevensbeschermingsautoriteit.be</a>。"
    ]
  ],
  "providersTitle": "哪些服务帮助运行网站",
  "providersNote": "Vercel 托管网站，PostHog EU 提供统计，Resend 发送登录邮件，托管的 Redis 服务保存临时记录。实际部署的 Redis 服务商及地区仍待确认，可联系我了解详情。外部服务可能依据其合同及跨境传输保障在欧洲经济区以外处理数据。它们的政策也说明日志与备份的处理方式。",
  "roles": [
    "网站托管",
    "访问统计",
    "登录邮件",
    "Redis（若使用 Upstash）",
    "Redis（若使用 Redis Cloud）",
    "地图图块",
    "播放",
    "歌曲查询",
    "支持付款",
    "预约",
    "手动 X 记录"
  ],
  "consentInfo": "统计默认开启。‘ok’关闭提示并计一次 soldier，不代表同意分析。‘别统计我’、GPC 和 DNT 会切换为匿名页面总数。选择保留至你更改或清除网站数据；提示更新也不会撤销拒绝。"
};
