import { useState } from "react";

const sampleData = {
  invoiceNumber: "INV-047",
  issueDate: "25 December 2026",
  dueDate: "08 January 2027",
  fromName: "Nathan Thomas",
  tradingAs: "The Green Tangerine",
  businessType: "Live Music Entertainment",
  website: "www.thegreentangerine.com",
  toCompany: "The Holly & Ivy Tavern",
  toContact: "Margaret Whitfield",
  toAddress: "42 Cathedral Road\nCardiff CF11 9LL",
  description: "Live band performance — Christmas Eve Special\nFull 4-piece band, 2 × 45-minute sets\nIncluding festive repertoire and audience requests",
  amount: 1200.0,
  bankAccountName: "Nathan Thomas",
  bankName: "Starling Bank",
  bankSortCode: "60-83-71",
  bankAccountNumber: "12345678",
  paymentTermsDays: 14,
};

/* ============================================================
   SVG DECORATIONS
   ============================================================ */

const HollyCorner = ({ style }) => (
  <svg style={style} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Leaf 1 — upper-left, smooth oval with 3 pointed lobes per side */}
    <path d="M56,42 C54,38 52,36 48,34 C50,32 50,28 46,24 C44,20 46,16 50,12
             C52,16 54,20 56,22 C58,18 60,16 60,20 C60,24 58,28 58,32
             C60,34 60,38 58,42 Z"
      fill="#1a6b35" opacity="0.8"/>
    <path d="M56,42 Q52,28 50,12" stroke="#0f4420" strokeWidth="0.6" fill="none" opacity="0.5"/>

    {/* Leaf 2 — pointing right, with pointed lobes */}
    <path d="M60,44 C64,40 68,40 72,38 C72,42 76,42 80,40
             C84,40 86,44 82,46 C80,44 76,46 74,48
             C76,50 74,54 70,52 C66,50 62,48 60,46 Z"
      fill="#228B22" opacity="0.7"/>
    <path d="M60,44 Q72,42 82,44" stroke="#14601e" strokeWidth="0.6" fill="none" opacity="0.4"/>

    {/* Leaf 3 — pointing down-left */}
    <path d="M54,48 C50,52 48,56 44,60 C46,62 44,66 40,68
             C38,72 42,74 46,72 C46,68 50,66 52,64
             C50,68 52,70 56,68 C58,64 56,56 54,50 Z"
      fill="#1a6b35" opacity="0.65"/>
    <path d="M54,48 Q48,58 42,70" stroke="#0f4420" strokeWidth="0.6" fill="none" opacity="0.4"/>

    {/* Berry cluster — bright red, tight group of 3 */}
    <circle cx="55" cy="42" r="5.5" fill="#dc3545"/>
    <circle cx="61" cy="44" r="5" fill="#c82333"/>
    <circle cx="57" cy="48" r="5.2" fill="#dc3545"/>
    {/* Berry highlights — glossy shine */}
    <circle cx="53" cy="40" r="2" fill="#ff6b6b" opacity="0.5"/>
    <circle cx="59" cy="42" r="1.7" fill="#ff6b6b" opacity="0.5"/>
    <circle cx="55" cy="46" r="1.8" fill="#ff6b6b" opacity="0.5"/>
    {/* Berry dimples */}
    <circle cx="55" cy="42" r="0.8" fill="#a71d2a" opacity="0.3"/>
    <circle cx="61" cy="44" r="0.7" fill="#a71d2a" opacity="0.3"/>
    <circle cx="57" cy="48" r="0.8" fill="#a71d2a" opacity="0.3"/>
  </svg>
);

const Snowflake = ({ style, size = 24 }) => (
  <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.5">
      <line x1="12" y1="2" x2="12" y2="22"/>
      <line x1="3.3" y1="7" x2="20.7" y2="17"/>
      <line x1="3.3" y1="17" x2="20.7" y2="7"/>
      <line x1="12" y1="2" x2="10" y2="5"/>
      <line x1="12" y1="2" x2="14" y2="5"/>
      <line x1="12" y1="22" x2="10" y2="19"/>
      <line x1="12" y1="22" x2="14" y2="19"/>
      <line x1="3.3" y1="7" x2="5.8" y2="8.8"/>
      <line x1="3.3" y1="7" x2="5" y2="5.2"/>
      <line x1="20.7" y1="7" x2="18.2" y2="8.8"/>
      <line x1="20.7" y1="7" x2="19" y2="5.2"/>
      <line x1="3.3" y1="17" x2="5.8" y2="15.2"/>
      <line x1="3.3" y1="17" x2="5" y2="18.8"/>
      <line x1="20.7" y1="17" x2="18.2" y2="15.2"/>
      <line x1="20.7" y1="17" x2="19" y2="18.8"/>
    </g>
  </svg>
);

const ChristmasTree = ({ style }) => (
  <svg style={style} viewBox="0 0 60 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polygon points="30,8 18,30 42,30" fill="#1e5430" opacity="0.5"/>
    <polygon points="30,18 14,42 46,42" fill="#2d6b3f" opacity="0.45"/>
    <polygon points="30,30 10,56 50,56" fill="#1e5430" opacity="0.4"/>
    <polygon points="30,4 31.5,8 35,8 32.5,10.5 33.5,14 30,12 26.5,14 27.5,10.5 25,8 28.5,8" fill="#c9a84c" opacity="0.6"/>
    <rect x="27" y="56" width="6" height="8" fill="#5a3a20" opacity="0.4"/>
    <circle cx="25" cy="26" r="2" fill="#8b3a3a" opacity="0.6"/>
    <circle cx="35" cy="36" r="2" fill="#c9a84c" opacity="0.5"/>
    <circle cx="22" cy="44" r="2.5" fill="#8b3a3a" opacity="0.5"/>
    <circle cx="38" cy="48" r="2" fill="#c9a84c" opacity="0.5"/>
    <circle cx="30" cy="50" r="2" fill="#8b3a3a" opacity="0.4"/>
  </svg>
);

const Bauble = ({ style, color = "#8b3a3a" }) => (
  <svg style={style} viewBox="0 0 30 38" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="13" y="2" width="4" height="5" rx="1" fill="#c9a84c" opacity="0.6"/>
    <circle cx="15" cy="22" r="13" fill={color} opacity="0.4"/>
    <ellipse cx="11" cy="18" rx="4" ry="6" fill="white" opacity="0.08" transform="rotate(-20 11 18)"/>
  </svg>
);

const Pumpkin = ({ style, size = 50 }) => (
  <svg style={style} width={size} height={size} viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Stem */}
    <path d="M23,12 C23,8 25,5 28,4 C26,5 25,8 25,11" stroke="#5a7a34" strokeWidth="2" fill="none" opacity="0.8"/>
    {/* Main body — brighter orange */}
    <ellipse cx="25" cy="30" rx="18" ry="15" fill="#e06600" opacity="0.6"/>
    {/* Segment ridges */}
    <ellipse cx="18" cy="30" rx="8" ry="15" fill="#c45500" opacity="0.25"/>
    <ellipse cx="32" cy="30" rx="8" ry="15" fill="#c45500" opacity="0.25"/>
    <ellipse cx="25" cy="30" rx="6" ry="15" fill="#f07000" opacity="0.2"/>
    {/* Jack-o-lantern face — stronger contrast */}
    <polygon points="16,26 19,22 22,27" fill="#1a0d00" opacity="0.65"/>
    <polygon points="28,26 31,22 34,27" fill="#1a0d00" opacity="0.65"/>
    <path d="M18,34 C20,38 30,38 32,34 C30,36 20,36 18,34Z" fill="#1a0d00" opacity="0.6"/>
    {/* Highlight */}
    <ellipse cx="19" cy="24" rx="5" ry="8" fill="white" opacity="0.08" transform="rotate(-10 19 24)"/>
  </svg>
);

const Bat = ({ style, size = 36 }) => (
  <svg style={style} width={size} height={size * 0.6} viewBox="0 0 50 30" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M25 14 C22 8, 14 3, 2 5 C6 8, 8 10, 10 14 C8 12, 5 11, 2 12 C6 14, 10 16, 14 16 C10 18, 8 22, 6 26 C12 22, 16 18, 20 16 L25 20 L30 16 C34 18, 38 22, 44 26 C42 22, 40 18, 36 16 C40 16, 44 14, 48 12 C45 11, 42 12, 40 14 C42 10, 44 8, 48 5 C36 3, 28 8, 25 14Z" 
      fill="currentColor" opacity="0.4"/>
    <circle cx="22" cy="13" r="1.5" fill="#e8940a" opacity="0.7"/>
    <circle cx="28" cy="13" r="1.5" fill="#e8940a" opacity="0.7"/>
  </svg>
);

const Spider = ({ style }) => (
  <svg style={style} viewBox="0 0 40 50" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line x1="20" y1="0" x2="20" y2="18" stroke="#6a5a44" strokeWidth="0.8" opacity="0.4"/>
    <ellipse cx="20" cy="24" rx="5" ry="4" fill="#2a2226" opacity="0.6"/>
    <ellipse cx="20" cy="30" rx="7" ry="6" fill="#2a2226" opacity="0.5"/>
    <g stroke="#3a3028" strokeWidth="1" opacity="0.5">
      <path d="M15 24 C10 20, 6 16, 3 14"/>
      <path d="M15 26 C10 26, 5 28, 2 30"/>
      <path d="M15 28 C10 32, 6 36, 4 40"/>
      <path d="M14 30 C10 36, 8 40, 6 46"/>
      <path d="M25 24 C30 20, 34 16, 37 14"/>
      <path d="M25 26 C30 26, 35 28, 38 30"/>
      <path d="M25 28 C30 32, 34 36, 36 40"/>
      <path d="M26 30 C30 36, 32 40, 34 46"/>
    </g>
    <circle cx="18" cy="23" r="1.2" fill="#e8940a" opacity="0.6"/>
    <circle cx="22" cy="23" r="1.2" fill="#e8940a" opacity="0.6"/>
  </svg>
);

const Candle = ({ style }) => (
  <svg style={style} viewBox="0 0 20 50" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 6 C12 10, 14 14, 12 18 C11 20, 9 20, 8 18 C6 14, 8 10, 10 6Z" fill="#e8940a" opacity="0.5"/>
    <path d="M10 9 C11 12, 12 14, 11 17 C10.5 18, 9.5 18, 9 17 C8 14, 9 12, 10 9Z" fill="#ffcc44" opacity="0.4"/>
    <rect x="7" y="18" width="6" height="28" rx="1" fill="#d4c4a0" opacity="0.35"/>
    <ellipse cx="10" cy="18" rx="4" ry="2" fill="#e8d4b0" opacity="0.3"/>
    <path d="M12 22 C13 24, 13 28, 12.5 30" stroke="#d4c4a0" strokeWidth="1.5" fill="none" opacity="0.3"/>
  </svg>
);

const HeartCluster = ({ style }) => (
  <svg style={style} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Large background heart */}
    <path d="M50 85 C50 85, 15 55, 15 35 C15 22, 28 15, 38 20 C44 23, 48 28, 50 34 C52 28, 56 23, 62 20 C72 15, 85 22, 85 35 C85 55, 50 85, 50 85Z"
      fill="#b45064" opacity="0.2"/>
    {/* Medium heart upper-right */}
    <path d="M72 30 C72 30, 58 18, 58 10 C58 5, 63 2, 67 4 C69 5, 71 7, 72 9 C73 7, 75 5, 77 4 C81 2, 86 5, 86 10 C86 18, 72 30, 72 30Z"
      fill="#d4788a" opacity="0.3"/>
    {/* Medium heart upper-left */}
    <path d="M28 25 C28 25, 20 19, 20 14 C20 11, 23 9, 25 10 C26 11, 27 12, 28 13 C29 12, 30 11, 31 10 C33 9, 36 11, 36 14 C36 19, 28 25, 28 25Z"
      fill="#c4607a" opacity="0.35"/>
    {/* Small heart right */}
    <path d="M82 55 C82 55, 78 52, 78 49 C78 48, 79 47, 80 47.5 C81 48, 81 48, 82 49 C83 48, 83 48, 84 47.5 C85 47, 86 48, 86 49 C86 52, 82 55, 82 55Z"
      fill="#b45064" opacity="0.4"/>
    {/* Small heart left */}
    <path d="M18 60 C18 60, 15 58, 15 56 C15 55, 16 54, 17 54.5 C17.5 55, 17.5 55, 18 55.5 C18.5 55, 18.5 55, 19 54.5 C20 54, 21 55, 21 56 C21 58, 18 60, 18 60Z"
      fill="#d4788a" opacity="0.3"/>
  </svg>
);

const Rose = ({ style, size = 44 }) => (
  <svg style={style} width={size} height={size * 1.4} viewBox="0 0 40 56" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Stem */}
    <path d="M20,28 C20,34 19,42 20,54" stroke="#5a7a4a" strokeWidth="1.8" opacity="0.45"/>
    {/* Leaf on stem */}
    <path d="M20,40 C16,37 11,36 8,38 C11,40 16,40 20,40Z" fill="#5a7a4a" opacity="0.35"/>
    <path d="M20,40 L11,37" stroke="#4a6a3a" strokeWidth="0.5" opacity="0.3"/>
    {/* Outer petals — large swooping curves */}
    <path d="M20,10 C12,12 6,18 8,24 C9,27 13,28 16,26 C12,24 11,20 14,16Z" fill="#9a3050" opacity="0.3"/>
    <path d="M20,10 C28,12 34,18 32,24 C31,27 27,28 24,26 C28,24 29,20 26,16Z" fill="#8a2840" opacity="0.3"/>
    {/* Mid petals — tighter curl */}
    <path d="M20,12 C15,14 11,19 13,23 C15,25 18,24 18,21 C17,18 17,15 19,13Z" fill="#b45064" opacity="0.35"/>
    <path d="M20,12 C25,14 29,19 27,23 C25,25 22,24 22,21 C23,18 23,15 21,13Z" fill="#a84058" opacity="0.35"/>
    {/* Inner bud — tight spiral center */}
    <path d="M20,15 C18,16 16.5,18 17.5,20 C18.5,21.5 20,21 20.5,19.5 C21,18 20.5,16 20,15Z" fill="#c4607a" opacity="0.45"/>
    <path d="M20,15 C22,16 23.5,18 22.5,20 C21.5,21.5 20,21 19.5,19.5 C19,18 19.5,16 20,15Z" fill="#d4708a" opacity="0.35"/>
    {/* Center dot */}
    <circle cx="20" cy="18" r="1.5" fill="#d4788a" opacity="0.4"/>
  </svg>
);

const HeartLine = ({ style }) => (
  <svg style={style} viewBox="0 0 400 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line x1="0" y1="10" x2="170" y2="10" stroke="#d4baba" strokeWidth="0.5" opacity="0.5"/>
    <path d="M190 10 C190 10, 185 5, 185 3 C185 1, 187 0, 188 1 C189 1.5, 189.5 2, 190 3 C190.5 2, 191 1.5, 192 1 C193 0, 195 1, 195 3 C195 5, 190 10, 190 10Z"
      fill="#b45064" opacity="0.4"/>
    <line x1="210" y1="10" x2="400" y2="10" stroke="#d4baba" strokeWidth="0.5" opacity="0.5"/>
  </svg>
);

/* ============================================================
   BAND LOGO
   ============================================================ */

const LOGO_THUMB = "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";

const BandLogo = ({ size = 48, style = {} }) => (
  <img
    src={`data:image/png;base64,${LOGO_THUMB}`}
    alt="TGT"
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      objectFit: "cover",
      flexShrink: 0,
      ...style,
    }}
  />
);

/* ============================================================
   CHRISTMAS / NEW YEAR'S TEMPLATE
   ============================================================ */
const ChristmasInvoice = ({ data }) => (
  <div
    style={{
      width: 595,
      minHeight: 842,
      background: "#0d1f14",
      fontFamily: "'Outfit', sans-serif",
      color: "#e8e0d4",
      position: "relative",
      overflow: "hidden",
      padding: 0,
    }}
  >
    {/* Paper grain texture */}
    <div style={{
      position: "absolute", inset: 0, pointerEvents: "none",
      backgroundImage: "radial-gradient(ellipse, #1a3020 0.8px, transparent 0.8px), radial-gradient(ellipse, #081510 0.5px, transparent 0.5px), radial-gradient(ellipse, #162a1c 0.3px, transparent 0.3px)",
      backgroundSize: "11px 11px, 7px 7px, 5px 5px",
      backgroundPosition: "0 0, 3px 5px, 7px 2px",
      opacity: 0.4,
    }} />

    {/* Snowflakes */}
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.6 }}>
      <Snowflake style={{ position: "absolute", top: 60, right: 44, color: "#c9a84c" }} size={20} />
      <Snowflake style={{ position: "absolute", top: 120, right: 90, color: "#5a7a5e" }} size={14} />
      <Snowflake style={{ position: "absolute", top: 200, right: 30, color: "#5a7a5e" }} size={10} />
      <Snowflake style={{ position: "absolute", bottom: 140, left: 30, color: "#5a7a5e" }} size={16} />
      <Snowflake style={{ position: "absolute", bottom: 80, left: 80, color: "#c9a84c" }} size={12} />
      <Snowflake style={{ position: "absolute", bottom: 200, right: 60, color: "#5a7a5e" }} size={11} />
    </div>

    {/* Holly corners */}
    <HollyCorner style={{ position: "absolute", top: -10, left: -10, width: 100, height: 100 }} />
    <HollyCorner style={{ position: "absolute", bottom: -10, right: -10, width: 90, height: 90, transform: "rotate(180deg)" }} />

    {/* Christmas tree watermark */}
    <ChristmasTree style={{ position: "absolute", bottom: 160, right: 40, width: 60, height: 80, opacity: 0.5 }} />

    {/* Baubles */}
    <Bauble style={{ position: "absolute", top: 180, left: 20, width: 22, height: 28 }} color="#8b3a3a" />
    <Bauble style={{ position: "absolute", bottom: 100, right: 110, width: 18, height: 24 }} color="#c9a84c" />

    {/* Gold top accent */}
    <div style={{ height: 4, background: "linear-gradient(90deg, transparent, #c9a84c, #e8c65a, #c9a84c, transparent)" }} />

    {/* Header */}
    <div style={{ padding: "36px 44px 28px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative", zIndex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <BandLogo size={50} style={{ border: "2px solid #c9a84c33" }} />
        <div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 700, color: "#c9a84c", letterSpacing: "0.5px", lineHeight: 1.1 }}>
            {data.tradingAs}
          </div>
          <div style={{ fontSize: 11, color: "#8b9e87", marginTop: 6, letterSpacing: "2px", textTransform: "uppercase" }}>
            {data.businessType}
          </div>
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 38, fontWeight: 300, color: "#8b3a3a", letterSpacing: "3px", textTransform: "uppercase" }}>
          Invoice
        </div>
        <div style={{ fontSize: 13, color: "#c9a84c", fontWeight: 600, marginTop: 4 }}>{data.invoiceNumber}</div>
      </div>
    </div>

    {/* Divider */}
    <div style={{ padding: "0 44px", display: "flex", alignItems: "center", gap: 12, position: "relative", zIndex: 1 }}>
      <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, transparent, #2d4a32)" }} />
      <div style={{ display: "flex", gap: 4 }}>
        {["●", "◆", "●"].map((s, i) => (
          <span key={i} style={{ color: i === 1 ? "#c9a84c" : "#8b3a3a", fontSize: 8 }}>{s}</span>
        ))}
      </div>
      <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, #2d4a32, transparent)" }} />
    </div>

    {/* Dates */}
    <div style={{ padding: "20px 44px", display: "flex", gap: 32, position: "relative", zIndex: 1 }}>
      {[
        { label: "Issue Date", value: data.issueDate },
        { label: "Due Date", value: data.dueDate },
        { label: "Payment Terms", value: `${data.paymentTermsDays} days` },
      ].map((item, i) => (
        <div key={i}>
          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "1.5px", color: "#5a7a5e", marginBottom: 4 }}>{item.label}</div>
          <div style={{ fontSize: 13, color: "#d4ccbc" }}>{item.value}</div>
        </div>
      ))}
    </div>

    {/* From / To */}
    <div style={{ padding: "12px 44px", display: "flex", gap: 40, position: "relative", zIndex: 1 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "1.5px", color: "#8b3a3a", marginBottom: 10, fontWeight: 700 }}>From</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#c9a84c" }}>{data.fromName}</div>
        <div style={{ fontSize: 12, color: "#8b9e87", marginTop: 2 }}>t/a {data.tradingAs}</div>
        <div style={{ fontSize: 11, color: "#7a8a76", marginTop: 6 }}>{data.website}</div>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "1.5px", color: "#8b3a3a", marginBottom: 10, fontWeight: 700 }}>Bill To</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#e8e0d4" }}>{data.toCompany}</div>
        <div style={{ fontSize: 12, color: "#b0a898", marginTop: 2 }}>{data.toContact}</div>
        <div style={{ fontSize: 11, color: "#7a8a76", marginTop: 6, whiteSpace: "pre-line" }}>{data.toAddress}</div>
      </div>
    </div>

    {/* Description */}
    <div style={{ padding: "24px 44px", position: "relative", zIndex: 1 }}>
      <div style={{ background: "#132a1a", border: "1px solid #2d4a32", borderRadius: 8, padding: "20px 24px" }}>
        <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "1.5px", color: "#5a7a5e", marginBottom: 10 }}>Description</div>
        <div style={{ fontSize: 13, color: "#d4ccbc", whiteSpace: "pre-line", lineHeight: 1.7 }}>{data.description}</div>
      </div>
    </div>

    {/* Amount */}
    <div style={{ padding: "8px 44px", position: "relative", zIndex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", background: "linear-gradient(135deg, #1a0a0a, #2a1515)", border: "1px solid #4a2020", borderRadius: 8 }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "2px", color: "#8b3a3a", fontWeight: 700 }}>Total Amount Due</div>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 700, color: "#c9a84c" }}>
          £{data.amount.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
        </div>
      </div>
    </div>

    {/* Bank details */}
    <div style={{ padding: "24px 44px", position: "relative", zIndex: 1 }}>
      <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "1.5px", color: "#8b3a3a", marginBottom: 12, fontWeight: 700 }}>Payment Details</div>
      <div style={{ display: "flex", gap: 32 }}>
        {[
          { label: "Account Name", value: data.bankAccountName },
          { label: "Bank", value: data.bankName },
          { label: "Sort Code", value: data.bankSortCode },
          { label: "Account No.", value: data.bankAccountNumber },
        ].map((item, i) => (
          <div key={i}>
            <div style={{ fontSize: 9, color: "#5a7a5e", marginBottom: 4, textTransform: "uppercase", letterSpacing: "1px" }}>{item.label}</div>
            <div style={{ fontSize: 12, color: "#d4ccbc", fontFamily: "'JetBrains Mono', monospace" }}>{item.value}</div>
          </div>
        ))}
      </div>
    </div>

    {/* Footer */}
    <div style={{ margin: "20px 44px 0", padding: "16px 0", borderTop: "1px solid #2d4a32", textAlign: "center", position: "relative", zIndex: 1 }}>
      <div style={{ fontSize: 10, color: "#5a7a5e", letterSpacing: "1px" }}>Thank you for your business — Wishing you a wonderful festive season ✦</div>
      <div style={{ fontSize: 9, color: "#3d5a42", marginTop: 6 }}>{data.website}</div>
    </div>

    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg, transparent, #c9a84c, #e8c65a, #c9a84c, transparent)" }} />
  </div>
);

/* ============================================================
   HALLOWEEN / BONFIRE NIGHT TEMPLATE
   ============================================================ */
const HalloweenInvoice = ({ data }) => {
  const halloweenData = {
    ...data,
    toCompany: "The Cauldron & Cask",
    toContact: "James Blackwood",
    toAddress: "13 Ember Lane\nBristol BS1 4DJ",
    description: "Live band performance — Halloween Special\nFull 4-piece band, 3 × 40-minute sets\nIncluding themed costumes and spooky repertoire",
    invoiceNumber: "INV-048",
    issueDate: "31 October 2026",
    dueDate: "14 November 2026",
  };

  return (
    <div
      style={{
        width: 595,
        minHeight: 842,
        background: "#111014",
        fontFamily: "'Space Grotesk', sans-serif",
        color: "#e0d8cc",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Dark grunge texture */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: "radial-gradient(ellipse, #1c181e 0.7px, transparent 0.7px), radial-gradient(ellipse, #0d0a0f 0.4px, transparent 0.4px), radial-gradient(ellipse, #201a1c 0.3px, transparent 0.3px)",
        backgroundSize: "13px 13px, 9px 9px, 5px 5px",
        backgroundPosition: "0 0, 4px 6px, 8px 3px",
        opacity: 0.5,
      }} />

      {/* Ember glow */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 200, background: "radial-gradient(ellipse at 50% -20%, rgba(204,85,0,0.15), transparent 70%)", pointerEvents: "none" }} />

      {/* Left ember strip */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 5, background: "linear-gradient(180deg, #cc5500, #e8940a, #cc5500, #8a3a00, #cc5500, #e8940a)" }} />

      {/* Pumpkin top-right */}
      <Pumpkin style={{ position: "absolute", top: 56, right: 38 }} size={46} />

      {/* Bats */}
      <Bat style={{ position: "absolute", top: 30, right: 140, color: "#4a3e34" }} size={32} />
      <Bat style={{ position: "absolute", top: 70, right: 200, color: "#3a3030" }} size={22} />
      <Bat style={{ position: "absolute", top: 110, left: 60, color: "#3a3030" }} size={18} />

      {/* Spider */}
      <Spider style={{ position: "absolute", top: -4, right: 100, width: 28, height: 36, opacity: 0.7 }} />

      {/* Candles */}
      <Candle style={{ position: "absolute", bottom: 40, left: 44, width: 14, height: 36, opacity: 0.8 }} />
      <Candle style={{ position: "absolute", bottom: 40, left: 64, width: 11, height: 30, opacity: 0.6 }} />
      <Candle style={{ position: "absolute", bottom: 40, right: 50, width: 12, height: 32, opacity: 0.7 }} />

      {/* More pumpkins */}
      <Pumpkin style={{ position: "absolute", bottom: 30, left: 100, opacity: 0.5 }} size={34} />
      <Pumpkin style={{ position: "absolute", bottom: 180, right: 30, opacity: 0.35 }} size={26} />

      {/* Header */}
      <div style={{ padding: "40px 44px 24px 54px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <BandLogo size={48} style={{ border: "2px solid #cc550044" }} />
          <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 30, fontWeight: 800, color: "#e8940a", letterSpacing: "-0.5px", lineHeight: 1.1, textTransform: "uppercase" }}>
              {halloweenData.tradingAs}
            </div>
            <div style={{ fontSize: 10, color: "#6a5a44", marginTop: 6, letterSpacing: "3px", textTransform: "uppercase" }}>
              {halloweenData.businessType}
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 800, color: "#cc5500", letterSpacing: "6px", textTransform: "uppercase" }}>Invoice</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, color: "#e8940a", fontWeight: 700, marginTop: 4 }}>{halloweenData.invoiceNumber}</div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ padding: "0 44px 0 54px", display: "flex", alignItems: "center", gap: 8, position: "relative", zIndex: 1 }}>
        <div style={{ flex: 1, height: 2, background: "linear-gradient(90deg, #cc5500, transparent)" }} />
        <span style={{ color: "#cc5500", fontSize: 16, fontWeight: 800 }}>/</span>
        <span style={{ color: "#e8940a", fontSize: 16, fontWeight: 800 }}>/</span>
        <span style={{ color: "#cc5500", fontSize: 16, fontWeight: 800 }}>/</span>
        <div style={{ flex: 1, height: 2, background: "linear-gradient(90deg, transparent, #cc5500)" }} />
      </div>

      {/* Dates */}
      <div style={{ padding: "20px 44px 12px 54px", display: "flex", gap: 32, position: "relative", zIndex: 1 }}>
        {[
          { label: "Issued", value: halloweenData.issueDate },
          { label: "Due", value: halloweenData.dueDate },
          { label: "Terms", value: `Net ${halloweenData.paymentTermsDays}` },
        ].map((item, i) => (
          <div key={i}>
            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "2px", color: "#5a4a34", marginBottom: 4, fontWeight: 700 }}>{item.label}</div>
            <div style={{ fontSize: 13, color: "#c4b8a4" }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* From / To */}
      <div style={{ padding: "16px 44px 12px 54px", display: "flex", gap: 40, position: "relative", zIndex: 1 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "2px", color: "#cc5500", marginBottom: 10, fontWeight: 700 }}>From</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#e8940a" }}>{halloweenData.fromName}</div>
          <div style={{ fontSize: 12, color: "#6a5a44", marginTop: 2 }}>t/a {halloweenData.tradingAs}</div>
          <div style={{ fontSize: 11, color: "#5a4a34", marginTop: 6 }}>{halloweenData.website}</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "2px", color: "#cc5500", marginBottom: 10, fontWeight: 700 }}>Bill To</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#e0d8cc" }}>{halloweenData.toCompany}</div>
          <div style={{ fontSize: 12, color: "#9a8a74", marginTop: 2 }}>{halloweenData.toContact}</div>
          <div style={{ fontSize: 11, color: "#6a5a44", marginTop: 6, whiteSpace: "pre-line" }}>{halloweenData.toAddress}</div>
        </div>
      </div>

      {/* Description */}
      <div style={{ padding: "20px 44px 12px 54px", position: "relative", zIndex: 1 }}>
        <div style={{ background: "#1a1618", border: "1px solid #2a2226", borderLeft: "3px solid #cc5500", borderRadius: "0 6px 6px 0", padding: "18px 22px" }}>
          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "2px", color: "#5a4a34", marginBottom: 10, fontWeight: 700 }}>Description</div>
          <div style={{ fontSize: 13, color: "#c4b8a4", whiteSpace: "pre-line", lineHeight: 1.7 }}>{halloweenData.description}</div>
        </div>
      </div>

      {/* Amount */}
      <div style={{ padding: "12px 44px 12px 54px", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 22px", background: "linear-gradient(135deg, #1a0d00, #261400)", border: "1px solid #3a2200", borderRadius: 6 }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "3px", color: "#cc5500", fontWeight: 700 }}>Amount Due</div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 34, fontWeight: 800, color: "#e8940a" }}>
            £{halloweenData.amount.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Bank details */}
      <div style={{ padding: "20px 44px 12px 54px", position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "2px", color: "#cc5500", marginBottom: 12, fontWeight: 700 }}>Payment Details</div>
        <div style={{ display: "flex", gap: 28 }}>
          {[
            { label: "Account Name", value: halloweenData.bankAccountName },
            { label: "Bank", value: halloweenData.bankName },
            { label: "Sort Code", value: halloweenData.bankSortCode },
            { label: "Account No.", value: halloweenData.bankAccountNumber },
          ].map((item, i) => (
            <div key={i}>
              <div style={{ fontSize: 9, color: "#5a4a34", marginBottom: 4, textTransform: "uppercase", letterSpacing: "1px" }}>{item.label}</div>
              <div style={{ fontSize: 12, color: "#c4b8a4", fontFamily: "'JetBrains Mono', monospace" }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ margin: "24px 44px 0 54px", padding: "14px 0", borderTop: "1px solid #2a2226", textAlign: "center", position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: 10, color: "#6a5a44", letterSpacing: "1px" }}>Thank you for your business 🔥</div>
        <div style={{ fontSize: 9, color: "#3a3028", marginTop: 6 }}>{halloweenData.website}</div>
      </div>
    </div>
  );
};

/* ============================================================
   VALENTINE'S DAY TEMPLATE
   ============================================================ */
const ValentineInvoice = ({ data }) => {
  const valData = {
    ...data,
    toCompany: "Rosewood & Vine",
    toContact: "Sophie Laurent",
    toAddress: "8 Lovers Walk\nBath BA1 2QH",
    description: "Live band performance — Valentine's Evening\nFull 4-piece band, 2 × 50-minute sets\nRomantic jazz and soul repertoire",
    invoiceNumber: "INV-049",
    issueDate: "14 February 2026",
    dueDate: "28 February 2026",
    amount: 1400.0,
  };

  return (
    <div
      style={{
        width: 595,
        minHeight: 842,
        background: "#faf5f0",
        fontFamily: "'Lora', serif",
        color: "#3a2028",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Warm linen texture */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(0deg, #ede3d8 0.5px, transparent 0.5px), linear-gradient(90deg, #ede3d8 0.5px, transparent 0.5px), radial-gradient(ellipse, #e8ddd2 0.4px, transparent 0.4px)",
        backgroundSize: "4px 4px, 4px 4px, 7px 7px",
        backgroundPosition: "0 0, 0 0, 2px 3px",
        opacity: 0.4,
      }} />

      {/* Heart clusters */}
      <HeartCluster style={{ position: "absolute", top: -10, right: -10, width: 160, height: 160 }} />
      <HeartCluster style={{ position: "absolute", bottom: 20, left: -20, width: 120, height: 120, transform: "rotate(180deg)", opacity: 0.6 }} />

      {/* Roses */}
      <Rose style={{ position: "absolute", top: 90, left: 20, opacity: 0.6 }} size={36} />
      <Rose style={{ position: "absolute", bottom: 140, right: 24, opacity: 0.5, transform: "scaleX(-1)" }} size={30} />
      <Rose style={{ position: "absolute", top: 300, right: 10, opacity: 0.35, transform: "rotate(15deg)" }} size={26} />

      {/* Scattered hearts */}
      {[
        { top: 200, left: 40, size: 16, opacity: 0.25, color: "#b45064" },
        { bottom: 240, left: 100, size: 12, opacity: 0.22, color: "#c4607a" },
        { top: 450, right: 60, size: 10, opacity: 0.18, color: "#d4788a" },
        { top: 160, right: 180, size: 8, opacity: 0.15, color: "#b45064" },
        { bottom: 300, right: 140, size: 14, opacity: 0.18, color: "#c4607a" },
      ].map((h, i) => (
        <svg key={i} style={{ position: "absolute", top: h.top, bottom: h.bottom, left: h.left, right: h.right, opacity: h.opacity }} width={h.size} height={h.size} viewBox="0 0 16 16">
          <path d="M8 14 C8 14, 2 9, 2 5 C2 3, 4 1, 6 2.5 C7 3, 7.5 4, 8 5 C8.5 4, 9 3, 10 2.5 C12 1, 14 3, 14 5 C14 9, 8 14, 8 14Z" fill={h.color}/>
        </svg>
      ))}

      {/* Top accent */}
      <div style={{ height: 4, background: "linear-gradient(90deg, #d4a0a0, #b45064, #d4a0a0)" }} />

      {/* Header */}
      <div style={{ padding: "36px 44px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <BandLogo size={48} style={{ border: "2px solid #b4506420" }} />
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 30, fontWeight: 700, color: "#8a3048", fontStyle: "italic", lineHeight: 1.1 }}>
              {valData.tradingAs}
            </div>
            <div style={{ fontSize: 10, color: "#b49898", marginTop: 6, letterSpacing: "2.5px", textTransform: "uppercase" }}>
              {valData.businessType}
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 400, color: "#c4a882", fontStyle: "italic", letterSpacing: "2px" }}>Invoice</div>
          <div style={{ fontSize: 13, color: "#8a3048", fontWeight: 600, marginTop: 4 }}>{valData.invoiceNumber}</div>
        </div>
      </div>

      {/* Heart divider */}
      <div style={{ padding: "0 44px", position: "relative", zIndex: 1 }}>
        <HeartLine style={{ width: "100%", height: 20 }} />
      </div>

      {/* Dates */}
      <div style={{ padding: "16px 44px 12px", display: "flex", gap: 36, position: "relative", zIndex: 1 }}>
        {[
          { label: "Issue Date", value: valData.issueDate },
          { label: "Due Date", value: valData.dueDate },
          { label: "Payment Terms", value: `${valData.paymentTermsDays} days` },
        ].map((item, i) => (
          <div key={i}>
            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "1.5px", color: "#b49898", marginBottom: 4 }}>{item.label}</div>
            <div style={{ fontSize: 13, color: "#5a3040" }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* From / To */}
      <div style={{ padding: "16px 44px", display: "flex", gap: 40, position: "relative", zIndex: 1 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "1.5px", color: "#8a3048", marginBottom: 10, fontWeight: 700 }}>From</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#3a2028" }}>{valData.fromName}</div>
          <div style={{ fontSize: 12, color: "#7a5a68", marginTop: 2, fontStyle: "italic" }}>t/a {valData.tradingAs}</div>
          <div style={{ fontSize: 11, color: "#9a7a88", marginTop: 6 }}>{valData.website}</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "1.5px", color: "#8a3048", marginBottom: 10, fontWeight: 700 }}>Bill To</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#3a2028" }}>{valData.toCompany}</div>
          <div style={{ fontSize: 12, color: "#7a5a68", marginTop: 2 }}>{valData.toContact}</div>
          <div style={{ fontSize: 11, color: "#9a7a88", marginTop: 6, whiteSpace: "pre-line" }}>{valData.toAddress}</div>
        </div>
      </div>

      {/* Description */}
      <div style={{ padding: "20px 44px", position: "relative", zIndex: 1 }}>
        <div style={{ background: "#f5ede8", border: "1px solid #e4d4cc", borderRadius: 8, padding: "20px 24px" }}>
          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "1.5px", color: "#b49898", marginBottom: 10 }}>Description</div>
          <div style={{ fontSize: 13, color: "#5a3040", whiteSpace: "pre-line", lineHeight: 1.7 }}>{valData.description}</div>
        </div>
      </div>

      {/* Amount */}
      <div style={{ padding: "8px 44px", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", background: "linear-gradient(135deg, #3a1828, #4a2038)", borderRadius: 8 }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "2px", color: "#d4a0a0", fontWeight: 700 }}>Total Amount Due</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 34, fontWeight: 700, color: "#faf5f0", fontStyle: "italic" }}>
            £{valData.amount.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Bank details */}
      <div style={{ padding: "24px 44px", position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "1.5px", color: "#8a3048", marginBottom: 12, fontWeight: 700 }}>Payment Details</div>
        <div style={{ display: "flex", gap: 28 }}>
          {[
            { label: "Account Name", value: valData.bankAccountName },
            { label: "Bank", value: valData.bankName },
            { label: "Sort Code", value: valData.bankSortCode },
            { label: "Account No.", value: valData.bankAccountNumber },
          ].map((item, i) => (
            <div key={i}>
              <div style={{ fontSize: 9, color: "#b49898", marginBottom: 4, textTransform: "uppercase", letterSpacing: "1px" }}>{item.label}</div>
              <div style={{ fontSize: 12, color: "#5a3040", fontFamily: "'JetBrains Mono', monospace" }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ margin: "16px 44px 0", padding: "14px 0", borderTop: "1px solid #e4d4cc", textAlign: "center", position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: 10, color: "#b49898", letterSpacing: "1px", fontStyle: "italic" }}>Thank you for a lovely evening ♥</div>
        <div style={{ fontSize: 9, color: "#d4c4bc", marginTop: 6 }}>{valData.website}</div>
      </div>

      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg, #d4a0a0, #b45064, #d4a0a0)" }} />
    </div>
  );
};

/* ============================================================
   MAIN APP
   ============================================================ */
export default function ThemedInvoicePreviews() {
  const [active, setActive] = useState("christmas");

  const tabs = [
    { id: "christmas", label: "🎄 Christmas", color: "#c9a84c" },
    { id: "halloween", label: "🎃 Halloween", color: "#e8940a" },
    { id: "valentine", label: "💕 Valentine's", color: "#b45064" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#141418", display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 16px", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,700;1,400&family=Outfit:wght@300;400;600;700&family=Syne:wght@400;600;700;800&family=Space+Grotesk:wght@400;500;700&family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=Lora:ital,wght@0,400;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />

      <h1 style={{ color: "#e0ddd8", fontSize: 20, fontWeight: 600, marginBottom: 4, letterSpacing: "-0.5px" }}>
        Themed Invoice Templates — Batch 1
      </h1>
      <p style={{ color: "#6a6a72", fontSize: 13, marginBottom: 20 }}>
        With decorative SVG illustrations
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: active === tab.id ? `2px solid ${tab.color}` : "2px solid #2a2a30",
              background: active === tab.id ? `${tab.color}18` : "#1e1e24",
              color: active === tab.id ? tab.color : "#6a6a72",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ borderRadius: 12, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
        {active === "christmas" && <ChristmasInvoice data={sampleData} />}
        {active === "halloween" && <HalloweenInvoice data={sampleData} />}
        {active === "valentine" && <ValentineInvoice data={sampleData} />}
      </div>

      <p style={{ color: "#4a4a52", fontSize: 11, marginTop: 20, textAlign: "center", maxWidth: 500 }}>
        All illustrations are inline SVGs — no network dependency. They'll render crisply at any size in the final PDF templates.
      </p>
    </div>
  );
}
