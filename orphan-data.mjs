/* ═══════════════════════════════════════════════════
   ORPHAN AIRLINE DATA (folded into gen_en_airlines.mjs)
   ───────────────────────────────────────────────────
   11 formerly hand-made EN airline pages, extracted into generator data objects so they
   render at the rich standard (SSOT salary hero + career ladder + comparison table + FAQ).
   NARRATIVE only — every salary number comes from SSOT salary-data.mjs at generate time
   (page() overrides stats[0]/[1] + salaryRows). No hand-typed annual-salary figures here.
   10 objects extracted via workflow wf_30afefaa-aaf; emirates hand-crafted (¥45M headline dropped).
   Regenerate the site after editing:  node gen_en_airlines.mjs
   ═══════════════════════════════════════════════════ */
export const airlines_orphans = [
  {
    "file": "air-france.html",
    "code": "AF",
    "color": "#002157",
    "nameEn": "Air France",
    "subtitle": "France's international flag carrier and a SkyTeam founding member, flying widebodies out of Paris Charles de Gaulle.",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🇫🇷 France"
      },
      {
        "cls": "tag-blue",
        "label": "🤝 SkyTeam"
      },
      {
        "cls": "tag-gray",
        "label": "🛫 Full-Service"
      },
      {
        "cls": "tag-gold",
        "label": "⭐ 4-Star"
      }
    ],
    "stats": [
      {
        "val": "~¥35M",
        "label": "Capt. Avg (widebody)"
      },
      {
        "val": "~¥18M",
        "label": "F/O Avg"
      },
      {
        "val": "~220",
        "label": "Fleet Size"
      },
      {
        "val": "170+",
        "label": "Destinations"
      }
    ],
    "overview": [
      "Air France is France's international flag carrier, founded in 1933 and hubbed at Paris Charles de Gaulle, serving more than 170 cities worldwide. A SkyTeam founding member, it forms the Air France-KLM group with KLM and also operates the low-cost subsidiary Transavia.",
      "France levies high income tax (up to 45%), but pay and conditions for European pilots are generally stable. The fleet is widebody-focused, led by the A380, B777 and A350."
    ],
    "facts": [
      {
        "k": "HQ",
        "v": "Paris, France"
      },
      {
        "k": "Founded",
        "v": "1933"
      },
      {
        "k": "Alliance",
        "v": "SkyTeam"
      },
      {
        "k": "Hub",
        "v": "Paris CDG"
      },
      {
        "k": "Fleet Size",
        "v": "~220"
      },
      {
        "k": "Income Tax",
        "v": "Up to 45%"
      }
    ],
    "salaryNote": "Converted at EUR/JPY=163. Compensation is EUR-based and quoted pre-tax. French income tax is progressive up to 45%. Flight-day and layover per diems are paid separately.",
    "ops": {
      "routes": "From the Paris Charles de Gaulle hub, Air France serves North America (New York, Los Angeles, Montreal), Asia (Tokyo, Shanghai, Bangkok), Africa (50+ cities), Latin America and the Middle East.",
      "fleet": "Airbus A380-800, A350-900, A330-200/300, Boeing 777-200ER/300ER, A220-300, A320/A321. Around 220 aircraft."
    },
    "training": [
      {
        "title": "Type Rating (EASA-approved ATO)",
        "body": "Type rating earned at an EASA Approved Training Organisation: ground school → simulator (incl. MCC) → LIFUS."
      },
      {
        "title": "LIFUS (Line Training)",
        "body": "After the type rating, Line Flying Under Supervision with an instructor captain — typically 50–80 legs (per EASA FCL.060)."
      },
      {
        "title": "Recurrent Checks (OPC/LPC)",
        "body": "Proficiency checks 1–2 times per year to EASA FCL.625/735 standards, overseen by national CAAs (DGAC and others)."
      },
      {
        "title": "Captain Upgrade & Additional Ratings",
        "body": "Command training after a Senior F/O period. Additional qualifications include LVP (low-visibility procedures), PBN, ETOPS and RVSM."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Staff Travel",
        "body": "Heavily discounted or free tickets for pilots and family, usable on alliance partner airlines too."
      },
      {
        "icon": "🏥",
        "title": "Medical Insurance",
        "body": "High-standard European medical cover. Loss-of-licence insurance is also common."
      },
      {
        "icon": "💰",
        "title": "Performance Bonus",
        "body": "Performance-linked bonus of roughly 2–4 months' pay, sometimes tied to individual evaluation."
      },
      {
        "icon": "📅",
        "title": "Paid Leave",
        "body": "25–35 days per year, backed by generous EU labour-law leave provisions."
      },
      {
        "icon": "🏦",
        "title": "Retirement / Company Pension",
        "body": "Defined-benefit or defined-contribution company pension (DBP/DCP), layered on top of the state pension."
      },
      {
        "icon": "🌐",
        "title": "Layover Allowance",
        "body": "Accommodation and per diems for overseas stays; higher cost-of-living allowances for major European cities."
      }
    ],
    "hiringStatus": "Foreign hiring of EASA ATPL holders is limited; French-language ability is an advantage.",
    "jobs": [
      {
        "title": "Captain / First Officer (Regular Recruitment)",
        "sub": "International flights. Paris CDG base.",
        "status": "Check Official Site",
        "statusTag": "gray",
        "details": [
          {
            "k": "License",
            "v": "EASA ATPL (or FCL-approved equivalent)"
          },
          {
            "k": "English",
            "v": "ICAO Level 4+"
          },
          {
            "k": "Min. Flight Time",
            "v": "Captain 5,000h+ (guide)"
          },
          {
            "k": "French",
            "v": "Conversational recommended"
          }
        ],
        "note": "Foreign hiring is sometimes run via joint recruitment campaigns with KLM."
      }
    ],
    "recruitUrl": "https://careers.airfranceklm.com"
  },
  {
    "file": "british-airways.html",
    "code": "BA",
    "color": "#002157",
    "nameEn": "British Airways",
    "subtitle": "The UK's flag carrier and a oneworld founding member, flying widebodies worldwide from its London Heathrow hub.",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🇬🇧 UK"
      },
      {
        "cls": "tag-blue",
        "label": "🌐 oneworld"
      },
      {
        "cls": "tag-gray",
        "label": "🏢 Full-Service"
      },
      {
        "cls": "tag-gold",
        "label": "⭐ 5-Star"
      }
    ],
    "stats": [
      {
        "val": "~¥30M",
        "label": "Capt. Avg (widebody)"
      },
      {
        "val": "~¥17M",
        "label": "F/O Avg"
      },
      {
        "val": "~280",
        "label": "Fleet Size"
      },
      {
        "val": "210+",
        "label": "Cities Served"
      }
    ],
    "overview": [
      "British Airways is the UK's largest flag carrier, flying from its London Heathrow (LHR) hub to more than 210 cities worldwide. A founding member of oneworld, it maintains close partnerships with Iberia, American Airlines and others, and sits within International Airlines Group (IAG).",
      "Its widebody backbone is the B777, A380 and B787. Note that the UK levies progressive income tax at rates up to 45%."
    ],
    "facts": [
      {
        "k": "HQ",
        "v": "London, UK"
      },
      {
        "k": "Founded",
        "v": "1974 (BOAC merger)"
      },
      {
        "k": "Alliance",
        "v": "oneworld (IAG)"
      },
      {
        "k": "Hub",
        "v": "Heathrow (LHR)"
      },
      {
        "k": "Fleet Size",
        "v": "~280"
      },
      {
        "k": "Income Tax",
        "v": "Yes (up to 45%)"
      }
    ],
    "salaryNote": "Converted at GBP/JPY = 190. UK income tax is progressive, up to 45%. Figures are reference values based on public data and industry benchmarks; layover per-diems and repatriation allowances are paid separately.",
    "ops": {
      "routes": "From the Heathrow hub, BA serves North America (New York, Los Angeles, Chicago and 15+ cities), Asia (Tokyo, Beijing, Singapore), plus the Middle East, Africa, South America and Australia.",
      "fleet": "Boeing 777-200/300ER, 787-8/9/10, Airbus A380-800, A350-1000, and A320/A321neo — roughly 280 aircraft."
    },
    "training": [
      {
        "title": "Type Rating (EASA-approved ATO)",
        "body": "Type rating earned at an EASA-approved Training Organisation (ATO): ground school → simulator (incl. MCC) → LIFUS."
      },
      {
        "title": "LIFUS (Line Training)",
        "body": "After the type rating, Line Flying Under Supervision with an instructor captain — typically ~50–80 legs (per EASA FCL.060)."
      },
      {
        "title": "Recurrent Checks (OPC/LPC)",
        "body": "Proficiency Checks 1–2 times per year to EASA FCL.625/735 standards, overseen by the national CAA (UK CAA/DGAC/LBA, etc.)."
      },
      {
        "title": "Command Upgrade & Ratings",
        "body": "Command training follows an SFO/Senior F/O period. Additional qualifications include LVP, PBN, ETOPS and RVSM."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Staff Travel",
        "body": "Heavily discounted or free tickets for pilots and family, usable on alliance partners too."
      },
      {
        "icon": "🏥",
        "title": "Medical Insurance",
        "body": "High-standard European health cover; loss-of-licence insurance is common."
      },
      {
        "icon": "💰",
        "title": "Bonus",
        "body": "Performance-linked bonus of roughly 2–4 months' pay, sometimes tied to individual performance."
      },
      {
        "icon": "📅",
        "title": "Paid Leave",
        "body": "25–35 days per year, backed by generous EU-directive labour law."
      },
      {
        "icon": "🏦",
        "title": "Company Pension",
        "body": "Defined-benefit or defined-contribution company pension (DBP/DCP), layered on top of the state pension."
      },
      {
        "icon": "🌐",
        "title": "Layover Allowance",
        "body": "Hotel and per-diem for overseas stays, with a higher cost-of-living uplift for major European cities."
      }
    ],
    "hiringStatus": "Regular recruitment open — for EASA / UK CAA ATPL holders.",
    "jobs": [
      {
        "title": "Captain & First Officer (Regular Intake)",
        "sub": "International operations, primarily Heathrow-based.",
        "status": "Hiring",
        "statusTag": "green",
        "details": [
          {
            "k": "License",
            "v": "UK CAA/EASA ATPL"
          },
          {
            "k": "English",
            "v": "ICAO Level 4+"
          },
          {
            "k": "Min. Hours",
            "v": "5,000h+ (Captain)"
          },
          {
            "k": "Type",
            "v": "B777/A380/B787 preferred"
          }
        ],
        "note": "Post-Brexit, a UK CAA ATPL (or a conversion from EASA) is required. EU citizens and UK-resident foreign nationals may also apply."
      }
    ],
    "recruitUrl": "https://www.britishairways.com/careers"
  },
  {
    "file": "delta.html",
    "code": "DL",
    "color": "#003DA5",
    "nameEn": "Delta Air Lines",
    "subtitle": "Delta Air Lines — one of the largest US carriers, with among the highest pilot pay in the world.",
    "tags": [
      {
        "cls": "tag-orange",
        "label": "🇺🇸 USA"
      },
      {
        "cls": "tag-green",
        "label": "🟢 Actively Hiring"
      },
      {
        "cls": "tag-orange",
        "label": "🏆 Industry-Leading Pay"
      },
      {
        "cls": "tag-gray",
        "label": "🤝 SkyTeam Member"
      }
    ],
    "stats": [
      {
        "val": "~¥62M",
        "label": "Capt. Avg (all fleet)"
      },
      {
        "val": "~¥35M",
        "label": "F/O Avg"
      },
      {
        "val": "17%",
        "label": "401(k) Company Contribution"
      },
      {
        "val": "10%+",
        "label": "Profit Sharing"
      }
    ],
    "overview": [
      "Founded in 1924, Delta Air Lines is one of the world's largest airline groups. Atlanta is its main hub, with New York (JFK/LGA), Los Angeles, Seattle and Detroit as other key bases. Delta is a leader within SkyTeam and holds a strong alliance with KLM and Air France.",
      "Its pilot pay ranks among the very best in the industry. The 2024 collective bargaining agreement (CBA) delivered major raises; senior captains routinely earn top-tier pay, and peak compensation including profit sharing reaches among the highest levels in the industry."
    ],
    "facts": [
      {
        "k": "HQ",
        "v": "Atlanta, Georgia"
      },
      {
        "k": "Founded",
        "v": "1924"
      },
      {
        "k": "Alliance",
        "v": "SkyTeam"
      },
      {
        "k": "Hubs",
        "v": "ATL · JFK/LGA · LAX · SEA"
      },
      {
        "k": "Fleet Size",
        "v": "~900 aircraft"
      },
      {
        "k": "Ret. Age",
        "v": "65 (federal law)"
      }
    ],
    "salaryNote": "Yen figures converted at USD/JPY = 159. US federal income tax (up to 37%) plus state tax apply on top, but fully using tax-advantaged accounts like the 401(k) and HSA can meaningfully raise real take-home pay.",
    "ops": {
      "routes": "Main hub Atlanta (ATL), the world's busiest airport, plus New York (JFK/LGA), Los Angeles (LAX) and Seattle (SEA). 300+ destinations across six continents, with nonstop service to Tokyo Narita and Haneda — Tokyo-based pilots are on staff.",
      "fleet": "~900 aircraft: A220 (regional), B737-900ER (domestic mainstay), A330/A350 (medium-to-long-haul international), B767/B757 (international and domestic)."
    },
    "training": [
      {
        "title": "New F/O Training",
        "body": "Ground school → simulator training → IOE (initial operating experience). Fully company-paid."
      },
      {
        "title": "Type Rating Transition",
        "body": "Company covers all costs when moving to a new aircraft; fleet and routes are chosen by seniority via the bid system."
      },
      {
        "title": "Captain Upgrade",
        "body": "Seniority-based. Upgrade to captain typically takes 7–12 years, varying with the company's fleet demand."
      },
      {
        "title": "Advanced Qualification Program (AQP)",
        "body": "FAA-approved training program customized to each pilot's individual skill level."
      },
      {
        "title": "Delta Flight Products",
        "body": "Delta's own flight-simulator facility at the Atlanta HQ, using the latest-generation simulators."
      },
      {
        "title": "Line Check / PC",
        "body": "One to two proficiency checks per year; passing is required to continue line flying."
      }
    ],
    "benefits": [
      {
        "icon": "🏦",
        "title": "401(k) Retirement Plan",
        "body": "Company contributes 17% of pay directly (rising to 18% from January 2026); personal top-up contributions also allowed."
      },
      {
        "icon": "💰",
        "title": "Profit Sharing",
        "body": "2024 result: 10.4% of profit shared with all employees including pilots — worth millions of yen a year."
      },
      {
        "icon": "✈️",
        "title": "Travel Privileges",
        "body": "Free and discounted flights for the pilot, family and designated buddies, usable across SkyTeam carriers too."
      },
      {
        "icon": "🏥",
        "title": "Medical / Dental / Vision",
        "body": "Comprehensive health insurance covering family, with a company contribution to an HSA (Health Savings Account)."
      },
      {
        "icon": "📋",
        "title": "Loss-of-License Insurance",
        "body": "Income protection if you lose your license, whether on or off duty — an essential pilot cover."
      },
      {
        "icon": "🎓",
        "title": "Education Support",
        "body": "College tuition discount for children (Delta scholarship program) plus support for the pilot's own skill development."
      }
    ],
    "hiringStatus": "Actively Hiring",
    "jobs": [
      {
        "title": "First Officer — Domestic & International",
        "sub": "B737 / A320 / B757 / B767 / A330 / A350",
        "status": "Actively Hiring",
        "statusTag": "green",
        "details": [
          {
            "k": "License",
            "v": "US ATP Certificate"
          },
          {
            "k": "Flight Hours",
            "v": "1,500 hrs (1,000 for degree grads)"
          },
          {
            "k": "Hiring Pace",
            "v": "~60/month (2025)"
          }
        ],
        "note": "Requires US work authorization (green card or citizenship). No special track for Japanese speakers; an ATP earned in English is a prerequisite."
      },
      {
        "title": "Captain Upgrade — Internal Only",
        "sub": "Seniority-based upgrade from internal F/Os",
        "status": "Internal Only",
        "statusTag": "blue",
        "details": [
          {
            "k": "Eligibility",
            "v": "Current Delta F/Os"
          },
          {
            "k": "Timeline",
            "v": "7–12 years to upgrade"
          },
          {
            "k": "Direct Entry",
            "v": "Not offered"
          }
        ],
        "note": "No direct-entry captain hiring from outside. Upgrade to captain generally comes 7–12 years after joining."
      }
    ],
    "recruitUrl": "https://www.deltajobs.net/flight-crew"
  },
  {
    "file": "gulf-air.html",
    "code": "GF",
    "color": "#B68A3E",
    "nameEn": "Gulf Air",
    "subtitle": "Bahrain's national flag carrier and one of the Middle East's oldest airlines, offering tax-free pay.",
    "tags": [
      {
        "cls": "tag-gold",
        "label": "🇧🇭 Bahrain"
      },
      {
        "cls": "tag-gold",
        "label": "🌴 Tax-Free"
      },
      {
        "cls": "tag-blue",
        "label": "🕌 Middle East"
      },
      {
        "cls": "tag-gray",
        "label": "✈️ Full-Service"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. (tax-free)"
      },
      {
        "val": "—",
        "label": "F/O (tax-free)"
      },
      {
        "val": "~30",
        "label": "Fleet Size"
      },
      {
        "val": "50+",
        "label": "Destinations"
      }
    ],
    "overview": [
      "Founded in 1950, Gulf Air is one of the oldest airlines in the Middle East and the national flag carrier of Bahrain, serving Asia, Europe, Africa and the wider Middle East from its Manama hub.",
      "Bahrain levies no personal income tax, and Gulf Air has a long track record of hiring foreign pilots on generous, family-friendly packages. It runs a mixed fleet of A320/A321 and A330 aircraft."
    ],
    "facts": [
      {
        "k": "HQ",
        "v": "Manama, Bahrain"
      },
      {
        "k": "Founded",
        "v": "1950"
      },
      {
        "k": "Alliance",
        "v": "None"
      },
      {
        "k": "Hub",
        "v": "Bahrain Int'l (BAH)"
      },
      {
        "k": "Fleet Size",
        "v": "~30 aircraft"
      },
      {
        "k": "Income Tax",
        "v": "None (tax-free)"
      }
    ],
    "salaryNote": "Bahrain has zero personal income tax, so figures are effectively take-home. Pay is USD-denominated (converted at USD/JPY=150), and on top of base pay Gulf Air provides housing, family medical insurance and home-leave tickets.",
    "ops": {
      "routes": "From the Bahrain hub to Europe (London, Athens), Asia (Thailand, Sri Lanka, India), Africa and across the Middle East — 50+ destinations.",
      "fleet": "Airbus A321neo, A321ceo and A330-200/300 — about 30 aircraft."
    },
    "training": [
      {
        "title": "Type Rating (EASA/GCAA/GACA approved)",
        "body": "Type rating obtained at a Gulf/EASA-approved ATO (UAE, Saudi, Qatar authorities). Ground school → simulator → LIFUS."
      },
      {
        "title": "LIFUS (Line Training)",
        "body": "After the type rating, Line Flying Under Supervision with an instructor captain, typically around 50–80 legs."
      },
      {
        "title": "Recurrent Checks (OPC/LPC)",
        "body": "Proficiency checks 1–2 times a year, supervised by the relevant national authority to ICAO standards."
      },
      {
        "title": "Command Upgrade",
        "body": "Seniority- or merit-based. Gulf full-service carriers weight flight hours and internal assessment; many foreign captains are hired."
      }
    ],
    "benefits": [
      {
        "icon": "🌴",
        "title": "Tax-Free Income",
        "body": "Bahrain (like the UAE, Saudi, Kuwait and Oman) has zero income tax — your take-home is your full salary."
      },
      {
        "icon": "🏠",
        "title": "Housing Allowance",
        "body": "Company-provided accommodation or a housing allowance; family accompaniment is commonly available."
      },
      {
        "icon": "✈️",
        "title": "Staff Travel",
        "body": "Free or heavily discounted tickets for you and your family, including partner airlines."
      },
      {
        "icon": "🏥",
        "title": "Medical Insurance",
        "body": "Comprehensive medical cover (including dental) for you and your family; loss-of-license insurance is standard."
      },
      {
        "icon": "🚗",
        "title": "Transport",
        "body": "Airport-to-home transfer service or a transport allowance."
      },
      {
        "icon": "💰",
        "title": "Bonus",
        "body": "Performance-linked or contract bonus; some are paid twice a year."
      }
    ],
    "hiringStatus": "Recruiting foreign captains and first officers on an ad-hoc basis. A320-family or A330 type-rated pilots preferred.",
    "jobs": [
      {
        "title": "Captain & First Officer — Foreign Hire",
        "sub": "International operations, Bahrain-based.",
        "status": "Ad-hoc Recruitment",
        "statusTag": "blue",
        "details": [
          {
            "k": "License",
            "v": "ATPL (ICAO)"
          },
          {
            "k": "English",
            "v": "ICAO Level 4+"
          },
          {
            "k": "Min Hours",
            "v": "Captain 5,000h+ (guideline)"
          },
          {
            "k": "Type",
            "v": "A330 or A320 family preferred"
          }
        ],
        "note": "Cost of living in Bahrain is lower than other major Gulf cities, making for comfortable living."
      }
    ],
    "recruitUrl": "https://www.gulfair.com/about-us/careers"
  },
  {
    "file": "oman-air.html",
    "code": "WY",
    "color": "#7A0C2E",
    "nameEn": "Oman Air",
    "subtitle": "Oman's state-owned flag carrier, offering a tax-free Muscat base and a compact but high-quality Boeing 787/737 network.",
    "tags": [
      {
        "cls": "tag-red",
        "label": "🇴🇲 Oman"
      },
      {
        "cls": "tag-gray",
        "label": "🏢 FSC"
      },
      {
        "cls": "tag-gold",
        "label": "💰 Tax-Free"
      },
      {
        "cls": "tag-blue",
        "label": "🕌 Middle East"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Captain (tax-free)"
      },
      {
        "val": "—",
        "label": "First Officer (tax-free)"
      },
      {
        "val": "~50",
        "label": "Fleet Size"
      },
      {
        "val": "55+",
        "label": "Destinations"
      }
    ],
    "overview": [
      "Oman Air is Oman's state-owned flag carrier, operating from its Muscat hub to Asia, Europe, Africa and across the Middle East. Oman levies zero personal income tax, so quoted pay is effectively take-home. The carrier actively recruits foreign pilots and backs them with generous housing, medical and education support.",
      "Its fleet is built around the Boeing 787 and Boeing 737. While the network is relatively compact, Oman Air is well regarded for its high-quality service."
    ],
    "facts": [
      {
        "k": "HQ",
        "v": "Muscat, Oman"
      },
      {
        "k": "Founded",
        "v": "1993"
      },
      {
        "k": "Alliance",
        "v": "None"
      },
      {
        "k": "Hub",
        "v": "Muscat Int'l (MCT)"
      },
      {
        "k": "Fleet Size",
        "v": "~50 aircraft"
      },
      {
        "k": "Income Tax",
        "v": "None (tax-free)"
      }
    ],
    "salaryNote": "Oman levies zero personal income tax, so quoted pay is effectively take-home. Compensation is USD-denominated (converted at USD/JPY=150). Housing, medical and education costs are provided separately in addition to base pay, and the captain package includes allowances.",
    "ops": {
      "routes": "From the Muscat hub, Oman Air serves Europe (London, Frankfurt, Zurich), Asia (Bangkok, Kuala Lumpur, Delhi, Tokyo), Africa and destinations across the Middle East — 55+ cities in total.",
      "fleet": "Boeing 787-8/9, B737 MAX 8 and B737-800 — around 50 aircraft."
    },
    "training": [
      {
        "title": "Type Rating (EASA/GCAA/GACA approved)",
        "body": "Type rating earned at an EASA-approved ATO or with a Gulf civil aviation authority (UAE, Saudi, Qatar). Ground school → simulator → LIFUS."
      },
      {
        "title": "LIFUS (Line Training)",
        "body": "After the type rating, Line Flying Under Supervision with an instructor captain — typically 50–80 legs."
      },
      {
        "title": "Recurrent Checks (OPC/LPC)",
        "body": "Proficiency checks once or twice a year, supervised by national authorities to ICAO standards."
      },
      {
        "title": "Command Upgrade",
        "body": "Seniority- or merit-based. Gulf full-service carriers weigh flight hours and internal assessments, and have a strong track record of hiring foreign captains."
      }
    ],
    "benefits": [
      {
        "icon": "🌴",
        "title": "Tax-Free Income",
        "body": "Oman, like the UAE, Saudi, Bahrain and Kuwait, levies no income tax — your gross pay is your take-home."
      },
      {
        "icon": "🏠",
        "title": "Housing Allowance",
        "body": "Company-provided accommodation or a housing allowance; family relocation is commonly permitted."
      },
      {
        "icon": "✈️",
        "title": "Staff Travel",
        "body": "Free or heavily discounted tickets for the pilot and family, including partner airlines."
      },
      {
        "icon": "🏥",
        "title": "Medical Insurance",
        "body": "Comprehensive medical cover (including dental) for pilot and family; loss-of-licence insurance is standard."
      },
      {
        "icon": "🚗",
        "title": "Transport",
        "body": "Airport-to-home transfer service or a transport allowance."
      },
      {
        "icon": "💰",
        "title": "Bonus",
        "body": "Performance-linked or contract bonus, in some cases paid twice a year."
      }
    ],
    "hiringStatus": "Hiring foreign Captains and First Officers. B787 type-rated pilots preferred.",
    "jobs": [
      {
        "title": "Captain / First Officer — Foreign Hire",
        "sub": "International operations, Muscat-based.",
        "status": "Actively Hiring",
        "statusTag": "green",
        "details": [
          {
            "k": "License",
            "v": "ATPL (ICAO-compliant)"
          },
          {
            "k": "English",
            "v": "ICAO Level 4+"
          },
          {
            "k": "Min Hours",
            "v": "Captain 5,000h+ (B787 1,000h+)"
          },
          {
            "k": "Contract",
            "v": "Fixed-term (2–3yr renewable)"
          }
        ],
        "note": "Standard package includes housing, family medical insurance and repatriation tickets."
      }
    ],
    "recruitUrl": "https://careers.omanair.com"
  },
  {
    "file": "qantas.html",
    "code": "QF",
    "color": "#EE1C25",
    "nameEn": "Qantas",
    "subtitle": "Australia's flag carrier and one of the world's oldest airlines — widebody captain pay ranks among the highest in the Asia-Pacific.",
    "tags": [
      {
        "cls": "tag-red",
        "label": "🇦🇺 Australia"
      },
      {
        "cls": "tag-blue",
        "label": "🌏 Oneworld"
      },
      {
        "cls": "tag-gray",
        "label": "✈️ Full-Service Carrier"
      },
      {
        "cls": "tag-gold",
        "label": "🌅 Project Sunrise (world's longest route)"
      }
    ],
    "stats": [
      {
        "val": "~¥37M",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "~¥21M",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "~200",
        "label": "Fleet Size"
      },
      {
        "val": "100+",
        "label": "Destinations"
      }
    ],
    "overview": [
      "Founded in 1920, Qantas Airways is one of the oldest airlines in the world and Australia's flag carrier. From its Sydney and Melbourne hubs it flies to Europe, North America, Asia and the South Pacific, and is a founding member of the Oneworld alliance. It also operates the low-cost subsidiary Jetstar and holds a large share of the Australian domestic market.",
      "In 2025–2026 Qantas plans to launch Project Sunrise, non-stop Sydney–London service flown with the A350-1000 — set to be the world's longest commercial route. Australia levies income tax (up to 45%), but pilots benefit from public healthcare (Medicare) and a strong superannuation retirement scheme."
    ],
    "facts": [
      {
        "k": "HQ",
        "v": "Sydney, Australia"
      },
      {
        "k": "Founded",
        "v": "1920"
      },
      {
        "k": "Alliance",
        "v": "Oneworld"
      },
      {
        "k": "Hubs",
        "v": "Sydney (SYD), Melbourne (MEL)"
      },
      {
        "k": "Fleet Size",
        "v": "~200 aircraft"
      },
      {
        "k": "Income Tax",
        "v": "Yes (up to 45%)"
      }
    ],
    "salaryNote": "AUD-denominated and pre-tax; first officer pay is seniority-based. Figures converted at AUD/JPY = 103. Australia's income tax reaches 45% at the top bracket, but pilots receive public healthcare (Medicare) and superannuation (statutory 11%+ retirement contributions). Reference values based on public and industry data.",
    "ops": {
      "routes": "From its Sydney and Melbourne hubs, Qantas serves Europe (London, Frankfurt), North America (Los Angeles, San Francisco), Asia (Tokyo, Beijing, Singapore) and the South Pacific, alongside a large domestic network.",
      "fleet": "Boeing 787-9, B737 MAX 10, Airbus A380-800, A350-1000 (on order) and A321neo — around 200 aircraft."
    },
    "training": [
      {
        "title": "Type Rating (CASA / CAA NZ approved)",
        "body": "Type training at CASA (Australia) or CAA New Zealand certified centers, using OEM facilities or Qantas' own simulators."
      },
      {
        "title": "LIFUS",
        "body": "After the type rating, line flying under supervision with an instructor captain — typically around 50–80 legs."
      },
      {
        "title": "Recurrent Checks (OPC/LPC)",
        "body": "Proficiency checks once or twice a year, in line with each country's civil aviation regulations."
      },
      {
        "title": "Captain Upgrade",
        "body": "Seniority-based. Promotion via internal assessment once CASA/CAA NZ requirements are met."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Staff Travel",
        "body": "Discounted or free travel for the employee and family, including on alliance partner airlines."
      },
      {
        "icon": "🏥",
        "title": "Medical Insurance",
        "body": "Australia/NZ public healthcare (Medicare/ACC) plus private health cover including dental."
      },
      {
        "icon": "💰",
        "title": "Superannuation (Retirement Pension)",
        "body": "Australia: Superannuation (statutory 11%+ contributions); NZ: KiwiSaver — a robust retirement savings scheme."
      },
      {
        "icon": "📅",
        "title": "Paid Leave",
        "body": "20–25 days per year, in line with Australian and New Zealand labor law."
      },
      {
        "icon": "💵",
        "title": "Per Diem",
        "body": "Duty allowances paid while on trips, differing between domestic and international flying."
      },
      {
        "icon": "🌏",
        "title": "Route Diversity",
        "body": "Varied flying across the South Pacific, Asia, Europe, North America and within Oceania."
      }
    ],
    "hiringStatus": "Actively recruiting on an ongoing basis. Open to CASA ATPL holders; Australian work authorization required.",
    "jobs": [
      {
        "title": "Captain & First Officer — Ongoing Recruitment",
        "sub": "Domestic and international flying. Sydney / Melbourne based.",
        "status": "Actively Hiring",
        "statusTag": "green",
        "details": [
          {
            "k": "License",
            "v": "CASA ATPL (or ICAO mutual recognition)"
          },
          {
            "k": "English",
            "v": "ICAO Level 4 or higher"
          },
          {
            "k": "Min Flight Time",
            "v": "5,000h+ for Captain (widebody experience preferred)"
          },
          {
            "k": "Work Eligibility",
            "v": "Australian citizen / PR / work visa required"
          }
        ],
        "note": "Pilot work may be possible on a long-term Australian work visa (e.g. TSS/482). A JCAB-to-CASA license conversion is required."
      }
    ],
    "recruitUrl": "https://www.qantas.com/au/en/about-us/careers.html"
  },
  {
    "file": "riyadh-air.html",
    "code": "RX",
    "color": "#006B4D",
    "nameEn": "Riyadh Air",
    "subtitle": "Saudi Arabia's tax-free startup flag carrier, recruiting pilots at scale ahead of a 124-aircraft fleet ramp.",
    "tags": [
      {
        "cls": "tag-gold",
        "label": "🇸🇦 Saudi Arabia"
      },
      {
        "cls": "tag-green",
        "label": "💰 Tax-Free Income"
      },
      {
        "cls": "tag-orange",
        "label": "🚀 New Flag Carrier"
      },
      {
        "cls": "tag-blue",
        "label": "📈 Actively Hiring"
      }
    ],
    "stats": [
      {
        "val": "¥43M–¥58M",
        "label": "Captain (tax-free)"
      },
      {
        "val": "¥29M–¥31M",
        "label": "First Officer (tax-free)"
      },
      {
        "val": "124",
        "label": "Aircraft on Order"
      },
      {
        "val": "Oct 2025",
        "label": "First Flights"
      }
    ],
    "overview": [
      "Riyadh Air is a startup carrier wholly owned by Saudi Arabia's Public Investment Fund (PIF). Positioned as the kingdom's second flag carrier alongside Saudia, it flew its first services in October 2025 from Riyadh's King Khalid International Airport, building an international network across Asia, Europe and the Middle East.",
      "As a cornerstone of the government's Vision 2030 tourism and economic-diversification strategy, the airline is running large-scale pilot recruitment. With a 124-aircraft order book and no established seniority list, early joiners have unusually strong upgrade prospects."
    ],
    "facts": [
      {
        "k": "HQ",
        "v": "Riyadh, Saudi Arabia"
      },
      {
        "k": "First Flights",
        "v": "October 2025"
      },
      {
        "k": "Owner",
        "v": "Saudi PIF (Public Investment Fund)"
      },
      {
        "k": "Hub",
        "v": "King Khalid Intl (RUH)"
      },
      {
        "k": "Fleet on Order",
        "v": "124 (787-9 · A321neo · A350-1000)"
      },
      {
        "k": "Income Tax",
        "v": "None (tax-free)"
      }
    ],
    "salaryNote": "Saudi Arabia levies no personal income tax, so pilot pay is effectively net (tax-free). Compensation is denominated in Saudi Riyal (SAR), converted at SAR/JPY ≈ 40 as of March 2026. Base monthly pay is paid × 12, with flight-hour overtime paid on top for hours flown above 75 hrs/month.",
    "ops": {
      "routes": "Riyadh-based international network. The summer-2026 plan covers 15+ cities: Amman, Bangkok, Cairo, Dubai, London Heathrow, Madrid, Manchester, Manila, Mumbai, Paris CDG, Kuala Lumpur, Jakarta, Islamabad, Lahore and Jeddah.",
      "fleet": "124 aircraft on order: Boeing 787-9 (39), Airbus A321neo (60) and Airbus A350-1000 (25). In 2026 the fleet is mainly the 787-9 and A321neo."
    },
    "training": [
      {
        "title": "Type Rating",
        "body": "Type training for each aircraft runs at approved training centres — Boeing's certified centre for the 787 and Airbus's for the A321."
      },
      {
        "title": "International Standards",
        "body": "Training follows ICAO standards and is conducted under IATA Operational Safety Audit (IOSA) certification."
      },
      {
        "title": "Checking System",
        "body": "A comprehensive framework is being built out, covering twice-yearly proficiency checks, line checks and UPRT (upset prevention and recovery training)."
      },
      {
        "title": "Fast Upgrade",
        "body": "As a startup, First Officers hired early have abundant future captain-upgrade opportunities — the window before seniority builds up is now."
      }
    ],
    "benefits": [
      {
        "icon": "🏠",
        "title": "Housing",
        "body": "Expat housing provided within Riyadh."
      },
      {
        "icon": "📚",
        "title": "Children's Education",
        "body": "Full international-school tuition support for up to 3 children."
      },
      {
        "icon": "✈️",
        "title": "Travel Allowance",
        "body": "20 round-trip business-class tickets a year between home and Riyadh."
      },
      {
        "icon": "💹",
        "title": "Profit Sharing",
        "body": "Annual profit-sharing tied to airline performance."
      },
      {
        "icon": "📈",
        "title": "Annual Raise",
        "body": "Automatic 5% pay increase every year."
      },
      {
        "icon": "🏥",
        "title": "Medical & Life Insurance",
        "body": "Global medical and life cover for the pilot and family."
      }
    ],
    "hiringStatus": "Actively hiring (as of 2026)",
    "jobs": [
      {
        "title": "First Officer — Boeing 787-9",
        "sub": "Widebody international First Officer",
        "status": "Now Hiring",
        "statusTag": "green",
        "details": [
          {
            "k": "Flight Time",
            "v": "2,000+ hrs (multi-crew jet)"
          },
          {
            "k": "License",
            "v": "Valid ICAO ATPL"
          },
          {
            "k": "Medical",
            "v": "Class 1, unrestricted"
          },
          {
            "k": "English",
            "v": "ICAO Level 5+"
          },
          {
            "k": "Age",
            "v": "Under 59"
          }
        ],
        "note": "Recent 12-month flying must meet minimum currency thresholds. See the original posting on Latest Pilot Jobs for full details."
      },
      {
        "title": "A321 Cadre Check Pilot — A321neo",
        "sub": "A321 training & checking instructor",
        "status": "Now Hiring",
        "statusTag": "green",
        "details": [
          {
            "k": "License",
            "v": "A320/A321 TRI/TRE or equivalent"
          },
          {
            "k": "Experience",
            "v": "Substantial A320-family captain time"
          },
          {
            "k": "English",
            "v": "ICAO Level 5+"
          }
        ],
        "note": "Instructor/examiner role supporting the A321 fleet's training and checking programme."
      }
    ],
    "recruitUrl": "https://www.riyadhair.com/en/careers/pilots"
  },
  {
    "file": "ryanair.html",
    "code": "FR",
    "color": "#073590",
    "nameEn": "Ryanair",
    "subtitle": "Europe's largest ultra-low-cost carrier by passenger numbers, based in Dublin.",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🇮🇪 Ireland"
      },
      {
        "cls": "tag-orange",
        "label": "🛫 ULCC"
      },
      {
        "cls": "tag-gray",
        "label": "🏴 Independent"
      },
      {
        "cls": "tag-red",
        "label": "🇪🇺 Europe's Largest"
      }
    ],
    "stats": [
      {
        "val": "~¥22.4M",
        "label": "Capt. Avg"
      },
      {
        "val": "¥14.5M–¥31M",
        "label": "Captain Range"
      },
      {
        "val": "~600",
        "label": "Fleet Size"
      },
      {
        "val": "200+",
        "label": "Cities Served"
      }
    ],
    "overview": [
      "Ryanair is Europe's largest ultra-low-cost carrier (ULCC) by passenger numbers. Based in Dublin, it runs a vast network connecting 200+ cities across Europe and North Africa. A uniform Boeing 737 MAX/800 fleet and relentless cost control deliver its low fares.",
      "Pilots need an EASA ATPL. Note that some are employed under 'pilot placement' or self-employed (Personal Service Company) contract arrangements rather than direct staff contracts."
    ],
    "facts": [
      {
        "k": "HQ",
        "v": "Dublin, Ireland"
      },
      {
        "k": "Founded",
        "v": "1984"
      },
      {
        "k": "Alliance",
        "v": "None (Independent)"
      },
      {
        "k": "Hubs",
        "v": "Dublin, Stansted (multi-base)"
      },
      {
        "k": "Fleet Size",
        "v": "~600"
      },
      {
        "k": "Income Tax",
        "v": "Depends on base country"
      }
    ],
    "salaryNote": "EUR-denominated; verify with each airline's official recruitment information. Some pilots are engaged via a Personal Service Company (self-employed) arrangement rather than direct staff contracts, and type-rating costs may be partly or fully self-funded. Figures are pre-tax, and actual net income varies by base country.",
    "ops": {
      "routes": "From Dublin, Stansted and 30+ bases across all of Europe (Spain, Italy, Portugal, Poland, etc.) plus North Africa (Morocco). Short-haul focused.",
      "fleet": "Boeing 737 MAX 8-200 and 737-800. ~600 aircraft — one of the world's largest single-type fleets."
    },
    "training": [
      {
        "title": "Type Rating (EASA-approved, cost note)",
        "body": "Uses EASA-certified ATOs. At LCCs, type-rating costs may be partly or fully self-funded depending on contract — confirm terms."
      },
      {
        "title": "LIFUS",
        "body": "Line training under an instructor captain after type rating. Short-haul-heavy LCC operations let pilots build legs relatively quickly."
      },
      {
        "title": "Recurrent Checks (OPC/LPC)",
        "body": "1–2 checks per year to EASA standards. LCCs meet the same safety standards as legacy carriers."
      },
      {
        "title": "Upgrade",
        "body": "FO-to-captain upgrade typically requires 4,000–5,000+ hours. LCCs can offer more frequent upgrade opportunities."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Staff Travel Discount",
        "body": "Discounted travel on Ryanair flights (LCC-level discounts)."
      },
      {
        "icon": "📈",
        "title": "Productivity Bonus",
        "body": "Sector-linked productivity bonus — more flight hours mean higher earnings."
      },
      {
        "icon": "🏠",
        "title": "Base Choice",
        "body": "Choose your base city from 30+ bases across Europe (subject to availability)."
      },
      {
        "icon": "📅",
        "title": "Paid Leave",
        "body": "EU-directive compliant; specifics vary by base country law."
      },
      {
        "icon": "🛫",
        "title": "Upgrade Opportunities",
        "body": "High-tempo short-haul flying can open earlier paths to command."
      },
      {
        "icon": "🛠️",
        "title": "Single Fleet Type",
        "body": "All-737 fleet simplifies training and roster flexibility."
      }
    ],
    "hiringStatus": "Actively hiring — Europe's largest-scale pilot recruitment. EASA ATPL required.",
    "jobs": [
      {
        "title": "Captain & First Officer — Continuous Recruitment",
        "sub": "European routes; many bases available.",
        "status": "Actively Hiring",
        "statusTag": "green",
        "details": [
          {
            "k": "License",
            "v": "EASA ATPL (mutual recognition possible)"
          },
          {
            "k": "English",
            "v": "ICAO Level 4+"
          },
          {
            "k": "Min Hours",
            "v": "FO: 500h+ (CPL held); Captain: 4,000h+"
          },
          {
            "k": "Type",
            "v": "B737 preferred; type cost may be self-funded"
          }
        ],
        "note": "Some contract types (pilot placement / self-employed) require self-funding the type rating. Confirm the employment arrangement carefully before applying."
      }
    ],
    "recruitUrl": "https://careers.ryanair.com"
  },
  {
    "file": "saudia.html",
    "code": "SV",
    "color": "#00694E",
    "nameEn": "Saudia",
    "subtitle": "Saudi Arabia's state-owned SkyTeam flag carrier — tax-free pay makes gross salary equal take-home.",
    "tags": [
      {
        "cls": "tag-green",
        "label": "🇸🇦 Saudi Arabia"
      },
      {
        "cls": "tag-blue",
        "label": "✈️ SkyTeam"
      },
      {
        "cls": "tag-gray",
        "label": "🏢 Full-Service Carrier"
      },
      {
        "cls": "tag-gold",
        "label": "🌴 Tax-Free"
      }
    ],
    "stats": [
      {
        "val": "~¥33M",
        "label": "Capt. Median (tax-free)"
      },
      {
        "val": "~¥18M",
        "label": "F/O Median (tax-free)"
      },
      {
        "val": "~150",
        "label": "Fleet Size"
      },
      {
        "val": "95+",
        "label": "Destinations"
      }
    ],
    "overview": [
      "Saudia (formerly Saudi Arabian Airlines) is the state-owned flag carrier of Saudi Arabia, founded in 1945. It flies to the Middle East, Europe, Asia and North America from hubs in Jeddah, Riyadh and Dammam, and joined SkyTeam in 2012.",
      "Because Saudi Arabia levies zero personal income tax, a pilot's stated salary is effectively net take-home pay — a key draw for foreign crews. The airline is expanding its network ahead of Vision 2030."
    ],
    "facts": [
      {
        "k": "HQ",
        "v": "Jeddah, Saudi Arabia"
      },
      {
        "k": "Founded",
        "v": "1945"
      },
      {
        "k": "Alliance",
        "v": "SkyTeam"
      },
      {
        "k": "Main Hub",
        "v": "King Abdulaziz Intl (JED)"
      },
      {
        "k": "Fleet Size",
        "v": "~150 aircraft"
      },
      {
        "k": "Income Tax",
        "v": "None (tax-free)"
      }
    ],
    "salaryNote": "Saudi Arabia has zero personal income tax, so these figures are net take-home pay. Converted at USD/JPY=150, SAR/JPY=40. Pay is USD-denominated and tax-free with allowances included. Housing, airport transport and medical insurance are provided separately.",
    "ops": {
      "routes": "From the Jeddah and Riyadh hubs, Saudia serves Europe (London, Paris, Frankfurt), Asia (Japan, Thailand, Malaysia), North America, Africa and destinations across the Middle East. It also operates seasonal Hajj and Umrah pilgrimage flights.",
      "fleet": "Boeing 777-300ER, 787-9/10 and 737 MAX 8, plus Airbus A321 and A320 — around 150 aircraft in total."
    },
    "training": [
      {
        "title": "Type Rating (EASA / GCAA / GACA approved)",
        "body": "Type rating gained at a Saudi, UAE or Qatari authority or an EASA-approved ATO. Ground school → simulator → LIFUS."
      },
      {
        "title": "LIFUS (Line Training)",
        "body": "After the type rating, Line Flying Under Supervision alongside an instructor captain — typically around 50–80 legs."
      },
      {
        "title": "Recurrent Checks (OPC / LPC)",
        "body": "Proficiency checks once or twice a year, supervised by the national authority to ICAO standards."
      },
      {
        "title": "Captain Upgrade",
        "body": "Seniority- or merit-based. Gulf full-service carriers weigh flight hours and internal assessments heavily, and hire many foreign captains directly."
      }
    ],
    "benefits": [
      {
        "icon": "🌴",
        "title": "Tax-Free Income",
        "body": "Saudi Arabia levies no personal income tax, so gross salary is effectively net take-home pay."
      },
      {
        "icon": "🏠",
        "title": "Housing Allowance",
        "body": "Company-provided accommodation or a housing allowance; family accompaniment is common."
      },
      {
        "icon": "✈️",
        "title": "Staff Travel",
        "body": "Free or heavily discounted tickets for the pilot and family, including partner airlines."
      },
      {
        "icon": "🏥",
        "title": "Medical Insurance",
        "body": "Comprehensive medical cover (including dental) for pilot and family; loss-of-licence insurance is typical."
      },
      {
        "icon": "🚗",
        "title": "Transport & Pickup",
        "body": "Airport-to-home transport service or a transport allowance."
      },
      {
        "icon": "💰",
        "title": "Bonus",
        "body": "Performance-linked or contract bonus, sometimes paid twice a year."
      }
    ],
    "hiringStatus": "Saudia has a track record of hiring foreign captains and first officers, though recruitment varies by period. Hiring is expanding ahead of Vision 2030.",
    "jobs": [
      {
        "title": "Captain & First Officer — Foreign Hire",
        "sub": "International flying, Jeddah / Riyadh base",
        "status": "Periodic Hiring",
        "statusTag": "blue",
        "details": [
          {
            "k": "License",
            "v": "ATPL (ICAO / GACA-approved)"
          },
          {
            "k": "English",
            "v": "ICAO Level 4+"
          },
          {
            "k": "Min. Hours",
            "v": "5,000h+ (Captain, guideline)"
          },
          {
            "k": "Contract",
            "v": "Fixed-term (2–3 yr renewable)"
          }
        ],
        "note": "Recruitment is expanding under Vision 2030; many roles are filled via agencies."
      }
    ],
    "recruitUrl": "https://www.saudia.com/about-saudia/careers"
  },
  {
    "file": "turkish-airlines.html",
    "code": "TK",
    "color": "#E30A17",
    "nameEn": "Turkish Airlines",
    "subtitle": "Istanbul-based Star Alliance flag carrier that flies to more countries than any other airline in the world.",
    "tags": [
      {
        "cls": "tag-red",
        "label": "🇹🇷 Turkey"
      },
      {
        "cls": "tag-blue",
        "label": "⭐ Star Alliance"
      },
      {
        "cls": "tag-gray",
        "label": "🛫 FSC"
      },
      {
        "cls": "tag-orange",
        "label": "🌍 Most Countries Served"
      }
    ],
    "stats": [
      {
        "val": "¥20M–¥30M",
        "label": "Capt. Salary (pre-tax)"
      },
      {
        "val": "¥11.5M–¥18M",
        "label": "F/O Salary (pre-tax)"
      },
      {
        "val": "~440",
        "label": "Fleet Size"
      },
      {
        "val": "130+",
        "label": "Countries Served (most in world)"
      }
    ],
    "overview": [
      "Turkish Airlines serves over 130 countries and 340-plus cities, and is known as the airline flying to more countries than any other. From its hub at Istanbul Airport (IST) it spans Europe, Asia, Africa and the Americas, and it is a Star Alliance member.",
      "Turkey levies income tax (up to 40%), though foreign pilots are sometimes offered USD-denominated special contracts. The fleet ranges from widebodies such as the B787, A330/A350 and B777 down to narrowbodies for domestic routes — about 440 aircraft in total."
    ],
    "facts": [
      {
        "k": "HQ",
        "v": "Istanbul, Turkey"
      },
      {
        "k": "Founded",
        "v": "1933"
      },
      {
        "k": "Alliance",
        "v": "Star Alliance"
      },
      {
        "k": "Hub",
        "v": "Istanbul Airport (IST)"
      },
      {
        "k": "Fleet Size",
        "v": "~440"
      },
      {
        "k": "Income Tax",
        "v": "Up to 40%"
      }
    ],
    "salaryNote": "Converted at USD/JPY≈150. Figures are pre-tax; Turkey's income tax (up to 40%) applies, though foreign pilots are sometimes offered USD-denominated special contracts. Based on public data (Glassdoor etc., 2025).",
    "ops": {
      "routes": "From its Istanbul hub, THY flies across all of Europe, North America (New York, Chicago), Asia (Japan, China, Thailand), Africa (50+ cities) and the Middle East — the world's largest country network.",
      "fleet": "Boeing 787-9, B777-300ER, B737 MAX 8/9, Airbus A350-900, A330-200/300, A321neo, A320neo. About 440 aircraft."
    },
    "training": [
      {
        "title": "Type Rating (EASA / authority-approved ATO)",
        "body": "Type rating obtained at an EASA or national authority-approved ATO. Ground school → simulator → LIFUS."
      },
      {
        "title": "LIFUS (Line Training)",
        "body": "After type rating, Line Flying Under Supervision alongside a training captain — typically around 50–80 sectors."
      },
      {
        "title": "Recurrent Checks (OPC/LPC)",
        "body": "Proficiency checks once or twice a year, supervised to ICAO standards by the relevant authority."
      },
      {
        "title": "Captain Upgrade",
        "body": "Seniority or merit based. Flight hours and internal assessment carry weight; foreign captains are frequently hired."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Staff Travel",
        "body": "Heavily discounted tickets for you and family, usable on Star Alliance partners too."
      },
      {
        "icon": "🏥",
        "title": "Medical Insurance",
        "body": "Comprehensive medical cover for pilot and family."
      },
      {
        "icon": "💰",
        "title": "Performance Bonus",
        "body": "Results-linked bonus, often paid 2–4 times a year."
      },
      {
        "icon": "📅",
        "title": "Paid Leave",
        "body": "22–28 days per year, with extra recovery leave on long-haul routes."
      },
      {
        "icon": "🏠",
        "title": "Housing Allowance",
        "body": "Istanbul housing allowance or provided accommodation for foreign pilots."
      },
      {
        "icon": "🌐",
        "title": "Layover Allowance",
        "body": "Hotel and per-diem for overseas stays, tiered by city rank."
      }
    ],
    "hiringStatus": "Foreign captain hiring on record; type-rated candidates preferred.",
    "jobs": [
      {
        "title": "Captain & First Officer (Foreign Hire)",
        "sub": "International operations · Istanbul base",
        "status": "Irregular Hiring",
        "statusTag": "blue",
        "details": [
          {
            "k": "License",
            "v": "ATPL (ICAO)"
          },
          {
            "k": "English",
            "v": "ICAO Level 4+"
          },
          {
            "k": "Min Hours",
            "v": "Captain 4,000h+ (guide)"
          },
          {
            "k": "Type",
            "v": "B787/A350/B777 widebody preferred"
          }
        ],
        "note": "Type training is also available in-house at THY's own Aviation Academy."
      }
    ],
    "recruitUrl": "https://www.turkishairlines.com/en-int/corporate/careers/"
  },
  {
    "file": "emirates.html",
    "code": "EK",
    "color": "#f5c842",
    "nameEn": "Emirates",
    "subtitle": "Emirates — UAE's flagship carrier based in Dubai. The tax-free package is the biggest draw for international pilots.",
    "tags": [
      {
        "cls": "tag-gold",
        "label": "🇦🇪 UAE"
      },
      {
        "cls": "tag-green",
        "label": "Actively Hiring"
      },
      {
        "cls": "tag-green",
        "label": "Zero Income Tax"
      },
      {
        "cls": "tag-gray",
        "label": "World's Largest Long-Haul Carrier"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (Tax-Free)"
      },
      {
        "val": "—",
        "label": "FO Avg (Tax-Free)"
      },
      {
        "val": "0%",
        "label": "UAE Personal Income Tax"
      },
      {
        "val": "270+",
        "label": "Fleet Size (World's Largest)"
      }
    ],
    "overview": [
      "Emirates was founded in Dubai (UAE) in 1985 and is the flag carrier of the United Arab Emirates. Operating from Dubai International Airport (DXB) as its hub, Emirates serves 150+ cities across 6 continents, making it one of the world's largest international airlines.",
      "The biggest advantage: <strong style=\"color:#f5c842\">the UAE has zero personal income tax</strong>, so your entire salary is <strong>100% take-home pay</strong>. Combined with generous housing and education allowances, Emirates is one of the most financially attractive careers for pilots worldwide."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Dubai, UAE"
      },
      {
        "k": "Founded",
        "v": "1985"
      },
      {
        "k": "Hub",
        "v": "Dubai Intl (DXB)"
      },
      {
        "k": "Destinations",
        "v": "150+ cities"
      },
      {
        "k": "Income Tax",
        "v": "0% (full take-home)"
      },
      {
        "k": "Retirement Age",
        "v": "65"
      }
    ],
    "salaryNote": "💡 UAE personal income tax is 0% — gross = net take-home. On top of base pay: housing (Captain AED 16,075/mo ≈ ¥940,000/mo, or a company villa), education allowance (up to 3 children), 42 days annual leave + a business-class home-leave ticket, and 75 guaranteed flight hours/month. Minimum 3% annual raise every May; profit sharing 2–24 weeks of base pay when targets are met. AED/JPY≈58. Japan routes: NRT / HND / KIX / NGO / FUK.",
    "ops": {
      "routes": "150+ destinations from Dubai (DXB) — among the world's most long-haul non-stop routes. Multiple daily flights to Japan (NRT, HND, KIX, NGO, FUK). 100% international routes — no domestic flying. Hub-and-spoke through DXB with 1,000+ daily departures.",
      "fleet": "A380 (world's largest fleet), B777-300ER (primary long-haul workhorse), B777X (on order), A350 (on order, deliveries from 2024)"
    },
    "training": [
      {
        "title": "Type Rating (Direct Entry)",
        "body": "For pilots with existing licenses. B777 or A380 type rating at Emirates Flight Training Academy (EFTA), Dubai. Duration ~3 months. Company-sponsored."
      },
      {
        "title": "Emirates Flight Training Academy",
        "body": "World-class training facility with all type simulators in-house. Training quality is among the industry's highest standards."
      },
      {
        "title": "Captain Upgrade",
        "body": "Typically 5–8 years as F/O before upgrading, subject to vacancies and performance evaluation. Direct Entry Captain recruitment is also common."
      },
      {
        "title": "Life in Dubai",
        "body": "English is widely used, with a large international community. Japanese schools and grocery stores available. Low crime rate, world-class healthcare and infrastructure."
      }
    ],
    "benefits": [
      {
        "icon": "🚫💰",
        "title": "Zero Income Tax",
        "body": "The UAE has 0% personal income tax. Every dirham of your salary is take-home pay — a decisive advantage over Japan."
      },
      {
        "icon": "🏠",
        "title": "Housing Allowance",
        "body": "Captain: AED 16,075/month (~¥940,000/month). First Officer: AED 14,325/month. Or a company-provided 3–4 bedroom villa with utilities included."
      },
      {
        "icon": "🎓",
        "title": "Education Allowance",
        "body": "Up to 3 children aged 4–19. Primary: AED 42,750/year per child. Secondary: AED 65,250/year per child. Covers Dubai international schools."
      },
      {
        "icon": "✈️",
        "title": "Travel Benefits",
        "body": "1 confirmed annual return home-leave ticket (business class). Unlimited concessional tickets for spouse + children. 15 extended-family tickets/year."
      },
      {
        "icon": "🏥",
        "title": "Medical & Dental",
        "body": "Full medical and dental coverage for pilot + all dependants, worldwide network. Full pay for up to 52 weeks sick leave (after 6-month probation)."
      },
      {
        "icon": "📋",
        "title": "Loss of License Insurance",
        "body": "Coverage up to 36 months of base salary for permanent license loss due to accident or illness. Essential protection for every commercial pilot."
      },
      {
        "icon": "💼",
        "title": "Provident Fund",
        "body": "Employee: 5% of base salary. Company: 12% for years 1–10, 15% from year 10+. Vests at 75% after 3–5 years, 100% after 5+ years."
      },
      {
        "icon": "📈",
        "title": "Profit Sharing",
        "body": "2–24 weeks of base salary paid in May when company performance targets are met. Historically paid most years (requires full Apr 1–Mar 31 employment)."
      },
      {
        "icon": "🌟",
        "title": "Annual Leave",
        "body": "42 calendar days per year (minimum 30 guaranteed under UAE law). Scheduling via roster management with fair rotation."
      }
    ],
    "hiringStatus": "Actively Hiring",
    "hiringColor": "#34d399",
    "jobs": [
      {
        "title": "Captain — B777 / A380 (Direct Entry)",
        "sub": "Experienced captain. Dubai-based.",
        "status": "Actively Hiring",
        "statusTag": "green",
        "details": [
          {
            "k": "Flight Hours",
            "v": "3,000+ hours PIC (B777/A380 type rating preferred)"
          },
          {
            "k": "English",
            "v": "ICAO Level 4+ (Level 6 preferred)"
          },
          {
            "k": "Hiring Volume",
            "v": "1,500+ planned for 2025–2026"
          }
        ],
        "note": "※ Work visa fully sponsored by Emirates. Pilots of all nationalities hired. Applications commonly submitted via recruitment consultants."
      },
      {
        "title": "First Officer — B777 / A380",
        "sub": "First Officer. Dubai-based.",
        "status": "Actively Hiring",
        "statusTag": "green",
        "details": [
          {
            "k": "Flight Hours",
            "v": "1,500+ hours (ATPL holders)"
          },
          {
            "k": "License",
            "v": "ATPL (frozen acceptable) or CPL + IR"
          },
          {
            "k": "Contract",
            "v": "Fixed Term → Permanent"
          }
        ],
        "note": ""
      }
    ],
    "recruitUrl": "https://www.emiratesgroupcareers.com/search-and-apply/186"
  }
];
