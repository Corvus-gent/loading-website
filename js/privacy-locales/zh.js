export default {
  "title": "隐私，不绕弯。",
  "intro": [
    "我们不想要你的数据。",
    "经你允许后，访问会汇总成匿名统计，不使用追踪 cookie。",
    "少量保存的信息（例如投票或登录码）列在下方，都有期限。"
  ],
  "updated": "更新于 2026 年 11 月 4 日",
  "sections": [
    [
      "who",
      "谁提着这盏灯？",
      "Francisco Gabriel Van Langenhove 负责 corvus.gent 和 stats.corvus.gent，包括音乐与游戏。问题或数据请求请联系：<a href=\"mailto:gabriel@corvus.gent\">gabriel@corvus.gent</a>。"
    ],
    [
      "counts",
      "统计什么",
      "只有你允许可选统计后才记录：页面访问、粗略的国家及浏览器类别、已知链接目的地，以及简单的音乐和游戏操作。PostHog EU 不使用追踪 cookie，也不建立个人档案。它会短暂处理网络和浏览器信息，生成每日变化的化名标识；只有汇总结果是匿名的。姓名、邮箱、表单内容、搜索词和录屏不会进入我们的分析。公开地图和 pingle 只使用至少有两名计入访客的城市，坐标经过取整。"
    ],
    [
      "why",
      "用途与法律依据",
      "同意：可选的 PostHog 统计，以及单独点击播放来启用 Spotify。合法利益：防止滥用及使用匿名总数。履行你的请求：登录、投票、游戏、访问申请和预约。关闭 Spotify 播放器或页面可停止播放。我们不出售你的数据，并尊重 do-not-track 和 global privacy control。"
    ],
    [
      "storage",
      "保存多久",
      "登录码：3 分钟。会话：7 天或直到退出。登录记录、访问申请及与邮箱关联的访客数竞猜：最多 90 天。防滥用记录：最多 24 小时，每天更换加盐 IP 哈希；我们的应用不保存原始 IP。机器人验证：5 分钟。服务器游戏历史：使用后 48 小时；连续游戏记录及防重复投票：最多一年。匿名总数和公开歌曲建议可保留至删除。",
      "分析事件的期限由 PostHog 项目设置决定；目标是 90 天，但该账户设置仍待确认。托管和邮件服务商的日志及备份有自己的期限。可联系我了解当前详情。",
      "Resend：美国存储；Free/Pro/Scale 邮件和日志保存 30 天，备份 7 天；Enterprise 可能不同。 <a href=\"https://resend.com/security/gdpr/\" rel=\"noreferrer\">Resend GDPR</a>."
    ],
    [
      "browser",
      "浏览器里的少量信息",
      "必要 cookie：sess 保持登录；vid 防止语言投票重复；mvid 保存音乐投票和每日游戏进度。它们经过签名、安全传输，页面脚本无法读取。sess 在 7 天后过期，vid 和 mvid 在一年后过期。它们从不用于分析身份识别。",
      "统计选择及隐私版本在本浏览器保存 180 天，或直到政策变更。localStorage 保存语言投票选择、语言、入口偏好、羽毛进度、游戏结果和是否阅读说明，保存后最多一年。清除网站数据会移除偏好，不会撤回已提交的投票。"
    ],
    [
      "outside",
      "其他服务何时参与",
      "只有点击播放后，Spotify 才收到播放请求，并可能设置自己的 cookie。你提交歌曲链接时，我们的服务器才向 Spotify 或 Apple 查询。CARTO 地图图块通过我们的服务器提供，不转发你的 IP。Leaflet、Sortable 和 PostHog 程序库均由本站托管。",
      "Buy Me a Coffee 和 Pidgy 预约都是链接，不是嵌入式表单。点击后适用各自的隐私政策。/links、/go 及推广短链接只添加 UTM 推广标签并统计访问和点击，不采集表单内容或访客身份。（统计仅在同意后进行）."
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
    "预约"
  ],
  "consentInfo": "可选统计默认关闭，只有你允许才开启。你可以随时在此修改选择。每个网站来源分别记住选择 180 天。拒绝不会限制网站功能；访问统计只包含同意的访客。撤回会停止今后的处理，不会撤销已完成的处理。"
};
