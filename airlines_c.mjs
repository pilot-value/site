/* ═══════════════════════════════════════════════════
   PHASE 2-C AIRLINE DATA (folded into gen_en_airlines.mjs)
   ───────────────────────────────────────────────────
   JP airline pages translated to EN via the team/PDCA workflow (translate → evaluate/edit).
   NARRATIVE only — every salary number comes from SSOT salary-data.mjs at generate time.
   Grows one batch at a time; regenerate the site after each:  node gen_en_airlines.mjs
   Airlines: 64. (auto-generated — do not hand-edit; edit the batch source instead)
   ═══════════════════════════════════════════════════ */
export const airlines_c = [
  {
    "code": "NH",
    "color": "#3d9bff",
    "file": "ana.html",
    "nameEn": "All Nippon Airways (ANA)",
    "subtitle": "All Nippon Airways — Japan's largest airline",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🇯🇵 Japan"
      },
      {
        "cls": "tag-blue",
        "label": "Cadet & Licensed-Pilot Hiring"
      },
      {
        "cls": "tag-gray",
        "label": "Full-Service Carrier"
      },
      {
        "cls": "tag-gold",
        "label": "International & Domestic"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "787/777 767/A320",
        "label": "Main Fleet"
      },
      {
        "val": "~4,000+",
        "label": "Pilots"
      }
    ],
    "overview": [
      "All Nippon Airways (ANA) is Japan's largest airline group (under ANA Holdings), with industry-leading scale across both international and domestic operations. Its own international network covers roughly 24 countries and about 41 cities, and through the Star Alliance network — including codeshares — it offers global-scale connectivity.",
      "A pilot career here is centered on hiring for company-sponsored cadets and self-funded license holders. With well-developed severance and pension schemes, it is an ideal environment for those who want to build a stable career within Japan."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Minato-ku, Tokyo"
      },
      {
        "k": "Founded",
        "v": "1952"
      },
      {
        "k": "Alliance",
        "v": "Star Alliance"
      },
      {
        "k": "Destinations",
        "v": "~24 countries / 41 cities (own operations)"
      },
      {
        "k": "Fleet Size",
        "v": "~270 aircraft"
      },
      {
        "k": "Retirement Age",
        "v": "65 (Captain)"
      }
    ],
    "salaryNote": "All figures are quoted pre-tax in Japanese yen (¥); income tax, resident tax and social insurance are withheld at source. Bonuses are performance-linked, at roughly 2–4 months of pay per year. A flight (duty) allowance is paid per flight hour, and an international layover allowance is paid separately according to the number of days spent overseas. Pilots receive a guaranteed minimum of 70–80 flight hours per month. Unlike some Gulf carriers, packages are not tax-free.",
    "ops": {
      "routes": "International network: daily flights to North America (New York, Los Angeles, Chicago, etc.); long-haul routes to Europe (London, Frankfurt, Paris, etc.); and short- to medium-haul routes across Asia (Shanghai, Hong Kong, Singapore, Bangkok, etc.). The A380 operates the Narita–Honolulu route, a distinctive fleet experience. Domestic network: major trunk routes including Haneda, Itami, New Chitose and Fukuoka. Domestic flying is centered on the A320/A321, with widebodies such as the B767 and B787 on trunk routes. The B737 and Q400/Q300 are operated by group company ANA Wings (a separate company).",
      "fleet": "Approximately 270 aircraft. Main types: B787 (international mainstay), B777 (long-haul international), B767 (domestic trunk & short-haul international), and A320/A321 (domestic mainstay). The A380 flies Narita–Honolulu and is operated by Captains only."
    },
    "training": [
      {
        "title": "Ground Academic Training (Cadet Program)",
        "body": "Aviation knowledge, meteorology, regulations, and more. About 6 months, conducted at the ANA Training Center (Haneda)."
      },
      {
        "title": "Initial Flight Training – Overseas (Cadet Program)",
        "body": "About 1–2 years at a partner flight school in Arizona, USA. Pilots earn private, instrument, multi-engine and commercial licenses. Foundational flight training toward promotion to First Officer (COP)."
      },
      {
        "title": "Type Rating Training / Aircraft Transition (Cadet Program)",
        "body": "Type training on the actual aircraft and in simulators. After obtaining line qualification, the pilot enters service as a First Officer."
      },
      {
        "title": "Upgrade Criteria (Captain / CAP Upgrade)",
        "body": "Roughly 10–15 years after joining is the guideline. A seniority-plus-merit system based on flight hours, evaluations, and vacancies."
      },
      {
        "title": "CAP Upgrade Training (Captain Upgrade)",
        "body": "Simulator training → actual-aircraft training → line check. After passing, the pilot enters service as a Captain."
      },
      {
        "title": "Recurrent Proficiency Check",
        "body": "Simulator assessments once or twice a year. Continuous maintenance of skill is required."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Flight Ticket Discounts",
        "body": "Heavily discounted air tickets for the employee and family. Also usable on Star Alliance partner airlines."
      },
      {
        "icon": "🏥",
        "title": "Health Insurance & Medical",
        "body": "ANA Health Insurance Society. A support system for pilot-specific aviation medical examinations. Loss-of-license insurance included."
      },
      {
        "icon": "🏦",
        "title": "Severance & Pension",
        "body": "Defined-benefit corporate pension plus defined-contribution pension. Lump-sum retirement payment based on years of service. Among the highest-tier severance schemes in Japan."
      },
      {
        "icon": "🏠",
        "title": "Housing Support",
        "body": "Company housing and dormitory programs. Housing allowance paid. Relocation-cost support according to base assignment."
      },
      {
        "icon": "👨‍👩‍👧",
        "title": "Childcare & Nursing-Care Support",
        "body": "A track record of childcare leave, schedule consideration after returning to work, and a full nursing-care leave system."
      },
      {
        "icon": "📚",
        "title": "Education & Skill Development",
        "body": "Subsidies for English and technical training costs. Living-expense support during overseas training. Support for obtaining qualifications."
      }
    ],
    "hiringStatus": "Cadet & Licensed-Pilot hiring open (as of March 2026)",
    "hiringColor": "#34d399",
    "jobs": [
      {
        "title": "ANA FY2026 Company-Sponsored (Cadet) Pilot",
        "sub": "Flight-crew trainee (new and prior graduates)",
        "status": "Accepting applications",
        "statusTag": "green",
        "details": [
          {
            "k": "Eligibility",
            "v": "University or graduate-school degree (any major)"
          },
          {
            "k": "Positions",
            "v": "A small number (competition ratio in the hundreds)"
          },
          {
            "k": "Start Date",
            "v": "April 2026 (new graduates)"
          }
        ],
        "note": "Training costs are fully covered by the company. English proficiency and physical fitness (Class 1 aviation medical certificate) are required."
      },
      {
        "title": "ANA Licensed-Pilot Hiring (self-funded license holders)",
        "sub": "Holders of CPL/ATPL via the Civil Aviation College, a private-university flight course, or self-funded training",
        "status": "Ad-hoc hiring (confirm officially)",
        "statusTag": "blue",
        "details": [
          {
            "k": "Target",
            "v": "CPL/ATPL holders (new graduates to early-career)"
          },
          {
            "k": "Flight Hours",
            "v": "Civil Aviation College graduate level (~200–300 hours)"
          },
          {
            "k": "Employment Type",
            "v": "Permanent full-time (open-ended)"
          }
        ],
        "note": "Important: ANA does not currently publicly advertise general mid-career (ready-to-fly) hiring of active pilots with line experience at other airlines. Licensed-pilot hiring is aimed at young pilots who have newly obtained their licenses. Check ANA's official website for hiring timing and conditions."
      }
    ],
    "recruitUrl": "https://www.ana.co.jp/group/recruit/"
  },
  {
    "code": "JL",
    "color": "#f5c842",
    "file": "jal.html",
    "nameEn": "Japan Airlines (JAL)",
    "subtitle": "Japan Airlines — Japan's second-largest airline group",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🇯🇵 Japan"
      },
      {
        "cls": "tag-gold",
        "label": "Company-trained cadets only"
      },
      {
        "cls": "tag-gray",
        "label": "Full-service carrier"
      },
      {
        "cls": "tag-gold",
        "label": "Oneworld member"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "A350/B777/B787",
        "label": "Main fleet"
      },
      {
        "val": "3,500+",
        "label": "Pilots"
      }
    ],
    "overview": [
      "Japan Airlines (JAL) was founded in 1951 and is Japan's second-largest airline group. After entering bankruptcy and filing for corporate reorganization in 2010, it re-listed on the stock exchange in 2012 and dramatically strengthened its financial position. As a Oneworld member carrier, it operates an international route network.",
      "Beyond the JAL mainline, the JAL Group also owns J-Air (domestic regional routes), ZIPAIR Tokyo (international low-cost carrier), and Jetstar Japan (domestic low-cost carrier) among its subsidiaries."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Shinagawa, Tokyo"
      },
      {
        "k": "Founded",
        "v": "1951"
      },
      {
        "k": "Alliance",
        "v": "Oneworld"
      },
      {
        "k": "Destinations",
        "v": "60+ countries"
      },
      {
        "k": "Fleet Size",
        "v": "approx. 240 aircraft"
      },
      {
        "k": "Retirement Age",
        "v": "65 (Captain)"
      },
      {
        "k": "Income Tax",
        "v": "Taxable (progressive, Japan)"
      }
    ],
    "salaryNote": "Pay is in Japanese yen and is fully taxable under Japan's progressive income and residence taxes plus social insurance — unlike tax-free Gulf carriers. Compensation combines base pay with an hourly flight (duty) allowance and an added premium for international routes. A performance-linked bonus of roughly two to four months' pay is paid annually, and an overseas layover allowance is paid separately according to city rank. JAL also has a distinctive completion bonus paid five years after upgrade to Captain, and provides loss-of-license insurance covering both on- and off-duty incidents.",
    "ops": {
      "routes": "International network: long-haul services to North America (New York, Los Angeles, Dallas and others); Europe (London, including codeshares with Finnair); and Asia and Oceania (Sydney, Bangkok, Bali and others). JAL was the first Japanese airline to introduce the Airbus A350, flown on Haneda-based routes. Domestic network: major trunk routes serving Haneda, Itami, New Chitose, Okinawa and other hubs. Regional routes are operated by group carrier J-Air (CRJ200/ERJ170), while the domestic mainline is flown mainly with the B737-800 and B767.",
      "fleet": "Around 240 aircraft. Airbus A350 — the fleet's latest-generation type, flown on both international and domestic routes; Boeing 777 (incl. 777-300ER) — the mainstay of long-haul international flying, carrying the highest flight hours and allowances; Boeing 787 (787-8/9) — the main type on medium-haul international routes across Asia and Oceania; Boeing 767-300 — domestic trunk and short-haul international; Boeing 737-800 — domestic mainline. Regional flying is handled by J-Air using CRJ200/ERJ170 aircraft."
    },
    "training": [
      {
        "title": "Ground school (approx. 6 months)",
        "body": "Conducted at the JAL Training Center in the Narita/Tokyo area. Covers aeronautical engineering, meteorology, aviation law and related subjects."
      },
      {
        "title": "Initial flight training (1–2 years)",
        "body": "Cadets are sent to partner flight schools in the United States, the Philippines and elsewhere to obtain their private through commercial licenses. Costs are fully covered by JAL."
      },
      {
        "title": "Type rating to F/O line entry",
        "body": "After obtaining a type rating on full-flight simulators, cadets pass a line check and enter service as First Officers (F/O)."
      },
      {
        "title": "Typical upgrade timing",
        "body": "About 10–15 years after joining. Timing is influenced by the company's fleet demand, individual performance evaluation and health status."
      },
      {
        "title": "Captain upgrade",
        "body": "Promotion to Captain follows simulator training plus aircraft training and passing a line check."
      },
      {
        "title": "Recurrent checks",
        "body": "Proficiency checks (in the simulator) are held one to two times per year. Continuous recurrent training is mandatory."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Flight ticket discounts",
        "body": "Discounted tickets for the employee and family, also usable across Oneworld partner airlines."
      },
      {
        "icon": "🏥",
        "title": "Health insurance & medical",
        "body": "JAL Health Insurance Society coverage, pilot-specialized medical support, and full loss-of-license insurance."
      },
      {
        "icon": "🏦",
        "title": "Retirement & pension",
        "body": "Defined-benefit corporate pension plus defined-contribution pension, and a lump-sum retirement allowance — a substantial scheme scaled to years of service."
      },
      {
        "icon": "🏠",
        "title": "Housing support",
        "body": "Company housing and dormitory system with a housing allowance, plus relocation cost support when changing base."
      },
      {
        "icon": "👨‍👩‍👧",
        "title": "Childcare & family care",
        "body": "Parental leave and reduced-hours working; male pilots have a track record of taking parental leave, and family-care leave is fully provided."
      },
      {
        "icon": "📚",
        "title": "Full training cost coverage",
        "body": "Cadet-program training costs (running to tens of millions of yen) are fully covered by JAL, as are type-rating training costs."
      }
    ],
    "hiringStatus": "Company-trained cadets only — FY2026 new-graduate cadet applications are open, but JAL does not currently hire licensed or experienced pilots (no direct entry).",
    "hiringColor": "#f5c842",
    "jobs": [
      {
        "title": "JAL FY2026 Company-Trained Cadet Pilot (New Graduate)",
        "sub": "Flight crew trainee — approx. 50 hires planned",
        "status": "Accepting applications",
        "statusTag": "green",
        "details": [
          {
            "k": "Eligibility",
            "v": "Expected to graduate (bachelor's or master's) in March 2026"
          },
          {
            "k": "Hires",
            "v": "Approx. 50 (applications opened Feb 2025)"
          },
          {
            "k": "Start date",
            "v": "April 2026"
          }
        ],
        "note": "A Class 1 aviation medical certificate is required. English proficiency (e.g. TOEIC) is also assessed. Competition can reach several hundred applicants per place."
      },
      {
        "title": "JAL Company-Trained Cadet Pilot (Career-Changer / Graduated Non-New-Grad Route)",
        "sub": "For working professionals and graduated non-new-grad job-seekers — trained from scratch after joining (no license required)",
        "status": "Age check required (up to ~30)",
        "statusTag": "gray",
        "details": [
          {
            "k": "Target",
            "v": "Working professionals / graduated non-new-grad job-seekers who do NOT hold a pilot license"
          },
          {
            "k": "Age",
            "v": "Up to about 30 (due to the long training pipeline)"
          },
          {
            "k": "License requirement",
            "v": "Must NOT already hold a pilot license"
          }
        ],
        "note": "Important: JAL does NOT currently conduct mid-career, ready-to-fly hiring of licensed pilots (CPL/ATPL holders). Even this career route trains applicants who hold no license from zero after joining. Intake of pilots with flight experience at other carriers is not currently open."
      }
    ],
    "recruitUrl": "https://www.jal.com/ja/recruit/"
  },
  {
    "file": "air-canada.html",
    "code": "AC",
    "color": "#C8102E",
    "nameEn": "Air Canada",
    "subtitle": "Air Canada — Canada's largest flag carrier · Star Alliance member",
    "tags": [
      {
        "cls": "tag-red",
        "label": "🇨🇦 Canada"
      },
      {
        "cls": "tag-blue",
        "label": "Star Alliance"
      },
      {
        "cls": "tag-gray",
        "label": "FSC"
      },
      {
        "cls": "tag-gold",
        "label": "No. 2 in North America"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "~200 aircraft",
        "label": "Fleet size"
      },
      {
        "val": "230+ cities",
        "label": "Destinations"
      }
    ],
    "overview": [
      "Air Canada is Canada's largest flag carrier. With hubs in Toronto, Montreal, and Vancouver, it serves more than 230 cities worldwide and is a member of Star Alliance. Canada levies income tax (a top federal rate of 33% plus provincial tax). Salaries denominated in CAD (Canadian dollars) are somewhat lower than in USD terms, but the standard of living is high. The <strong>B787, B777, and A220</strong> form the backbone of its fleet, and it also operates Rouge, a low-cost subsidiary."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Montreal, Canada"
      },
      {
        "k": "Hub",
        "v": "Toronto (YYZ) · Vancouver (YVR)"
      },
      {
        "k": "Alliance",
        "v": "Star Alliance"
      },
      {
        "k": "Founded",
        "v": "1936"
      },
      {
        "k": "Fleet Size",
        "v": "~200 aircraft"
      },
      {
        "k": "Income Tax",
        "v": "Yes (top federal rate 33% + provincial tax)"
      }
    ],
    "salaryNote": "Pilot pay is denominated in CAD (Canadian dollars) and quoted pre-tax, on a seniority-based scale; JPY figures assume a CAD/JPY rate of 110. Canada levies federal income tax (top rate 33%) plus provincial tax (for example, up to 13.16% in Ontario). Public healthcare and social security in Canada are well developed.",
    "ops": {
      "routes": "From its Toronto and Vancouver hubs, Air Canada serves all of North America, Europe (London, Frankfurt, and others), Asia (Tokyo, Hong Kong, and others), South America, the Caribbean, and Australia.",
      "fleet": "Boeing 787-8/9, B777-200LR/300ER, B737 MAX 8, Airbus A220-300, A319/A320/A321. Approximately 200 aircraft."
    },
    "training": [
      {
        "title": "Type Rating (FAA-approved)",
        "body": "Type-rating training at an FAA-certified ATO (Approved Training Organization), using Part 142 training centers such as CAE and FlightSafety. Ground school → simulator → LOFT."
      },
      {
        "title": "IOE (Initial Operating Experience)",
        "body": "After obtaining the type rating, Initial Operating Experience is flown with an instructor captain (Check Airman) aboard — typically around 25 to 50 legs."
      },
      {
        "title": "Recurrent Checks (PC/LOE)",
        "body": "A Proficiency Check (PC) or Line Operational Evaluation (LOE) is conducted one to two times per year, in accordance with FAA Part 121/135."
      },
      {
        "title": "Captain Upgrade",
        "body": "Upgrades are fundamentally seniority-based. Candidates must meet the required flight hours (typically 5,000–8,000+ hours) and pass a check with a Check Airman. An R-ATP (1,500-hour) pathway is available."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Staff Travel (Pass)",
        "body": "Pass travel for the employee and their family — free or heavily discounted travel on Air Canada's own flights and on partner carriers."
      },
      {
        "icon": "🏥",
        "title": "Medical, Dental & Vision Insurance",
        "body": "Comprehensive health insurance for the employee and their family. Loss-of-license insurance is also common."
      },
      {
        "icon": "💰",
        "title": "401(k) Retirement Plan",
        "body": "A defined-contribution pension (401(k)) with company matching — matches of up to 5–16% are common."
      },
      {
        "icon": "📅",
        "title": "Paid Leave",
        "body": "Roughly 15–30 days per year (increasing with seniority), with flexible time-off options such as flip and skip."
      },
      {
        "icon": "💵",
        "title": "Per Diem",
        "body": "A daily allowance on flying days (roughly $2–4 per hour), differing between domestic and international operations."
      },
      {
        "icon": "🌐",
        "title": "International Route Allowance",
        "body": "Additional allowances and lodging expenses for crew flying international routes."
      },
      {
        "icon": "🏥",
        "title": "Canadian Public Healthcare",
        "body": "Canada's Medicare (provincial public healthcare) provides basic medical care at no cost; dental and vision are covered through supplemental insurance."
      }
    ],
    "hiringStatus": "Hiring on a regular basis. Open to holders of a Transport Canada ATP. A Canadian work permit is required.",
    "hiringColor": "#34d399",
    "jobs": [
      {
        "title": "Captain / First Officer (Regular Intake)",
        "sub": "International operations. Toronto / Vancouver based.",
        "status": "Hiring",
        "statusTag": "green",
        "details": [
          {
            "k": "License",
            "v": "Transport Canada ATPL"
          },
          {
            "k": "English",
            "v": "ICAO Level 4 or above (English–French bilingual preferred)"
          },
          {
            "k": "Min. flight hours",
            "v": "Captain 5,000h+ (guideline)"
          },
          {
            "k": "Work eligibility",
            "v": "Canadian citizenship / permanent residency / work permit required"
          }
        ],
        "note": "Canadian permanent residency is relatively easy to obtain through the points-based Express Entry system, and pilots are a priority occupation."
      }
    ],
    "recruitUrl": "https://www.aircanada.com/ca/en/aco/home/about/careers.html"
  },
  {
    "code": "KL",
    "color": "#00A1DE",
    "file": "klm.html",
    "nameEn": "KLM Royal Dutch Airlines",
    "subtitle": "Carrying on the world's oldest airline name still in use · SkyTeam member",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🇳🇱 Netherlands"
      },
      {
        "cls": "tag-blue",
        "label": "SkyTeam"
      },
      {
        "cls": "tag-gray",
        "label": "FSC"
      },
      {
        "cls": "tag-gold",
        "label": "World's Oldest Brand"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "~170",
        "label": "Fleet Size"
      },
      {
        "val": "160+ cities",
        "label": "Destinations"
      }
    ],
    "overview": [
      "KLM Royal Dutch Airlines was founded in 1919. Known as \"the airline that has kept using the world's oldest name,\" it serves more than 160 cities worldwide from its hub at Amsterdam Schiphol. It is part of the Air France-KLM Group and a member of SkyTeam. Even among the major European full-service carriers (FSCs), it is known for its relatively good labor relations and stable employment package. The B777, B787, and A330 form the backbone of its fleet."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Amsterdam (Netherlands)"
      },
      {
        "k": "Hub",
        "v": "Schiphol Airport (AMS)"
      },
      {
        "k": "Alliance",
        "v": "SkyTeam"
      },
      {
        "k": "Founded",
        "v": "1919"
      },
      {
        "k": "Fleet Size",
        "v": "~170 aircraft"
      },
      {
        "k": "Income Tax",
        "v": "Yes (up to 49.5%)"
      }
    ],
    "salaryNote": "Salaries are denominated in EUR and quoted pre-tax, on a seniority-based pay scale. Dutch income tax is progressive, reaching a maximum of 49.5%. Foreign hires may qualify for the \"30% ruling\" (a foreign-worker tax incentive that exempts 30% of salary from taxation), which can meaningfully improve take-home pay. Yen figures are converted at EUR/JPY = 163.",
    "ops": {
      "routes": "From its Amsterdam Schiphol hub, KLM serves North America (New York, Los Angeles, etc.), Asia (Tokyo, Beijing, Bangkok, etc.), Africa (Nairobi, Johannesburg, etc.), and South America.",
      "fleet": "Boeing 777-200ER/300ER, B787-9/10, B737-800/MAX, Airbus A330-300, Embraer E2. Approximately 170 aircraft."
    },
    "training": [
      {
        "title": "Type Rating (EASA-Approved ATO)",
        "body": "Type rating obtained at an EASA-certified Approved Training Organisation (ATO). Ground school → simulator (including MCC) → LIFUS."
      },
      {
        "title": "LIFUS (Line Training)",
        "body": "After earning the type rating, Line Flying Under Supervision is conducted with an instructor captain on board. Typically around 50-80 legs (in line with EASA FCL.060)."
      },
      {
        "title": "Recurrent Checks (OPC/LPC)",
        "body": "Proficiency Checks (PC) once or twice a year, to EASA FCL.625/735 standards. Overseen by national CAAs (CAA UK, DGAC, LBA, etc.)."
      },
      {
        "title": "Captain Upgrade & Additional Qualifications",
        "body": "Captain training follows a period as SFO/Senior F/O. Additional qualifications such as LVP (Low Visibility Procedures), PBN, ETOPS, and RVSM are also acquired."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Staff Travel",
        "body": "Heavily discounted or free air tickets for the employee and family. Also usable on alliance partner carriers."
      },
      {
        "icon": "🏥",
        "title": "Medical Insurance",
        "body": "High-standard European medical insurance. Loss-of-license insurance is also common."
      },
      {
        "icon": "💰",
        "title": "Bonus",
        "body": "Performance-linked bonus (equivalent to 2-4 months' pay per year). In some cases tied to individual performance reviews."
      },
      {
        "icon": "📅",
        "title": "Paid Leave",
        "body": "25-35 days per year. A generous leave system under European labor law (EU directives)."
      },
      {
        "icon": "🏦",
        "title": "Retirement & Corporate Pension",
        "body": "Defined-benefit or defined-contribution corporate pension (DBP/DCP). In Europe this operates as a dual structure alongside the state pension."
      },
      {
        "icon": "🌐",
        "title": "Layover Allowance",
        "body": "Accommodation and per-diem paid for overseas stays. High-cost-area allowances tend to be higher for major European cities."
      },
      {
        "icon": "🇳🇱",
        "title": "30% Ruling",
        "body": "For foreign hires, the Dutch government's 30% ruling (which exempts 30% of salary from tax) may apply."
      }
    ],
    "hiringStatus": "Actively recruiting on a regular basis. Open to EASA ATPL holders.",
    "hiringColor": "#34d399",
    "jobs": [
      {
        "title": "Captain & First Officer (Regular Recruitment)",
        "sub": "International operations. Amsterdam-based.",
        "status": "Hiring",
        "statusTag": "green",
        "details": [
          {
            "k": "License",
            "v": "EASA ATPL"
          },
          {
            "k": "English",
            "v": "ICAO Level 4 or above"
          },
          {
            "k": "Min. Flight Hours",
            "v": "Captain 5,000h+"
          },
          {
            "k": "Type Rating",
            "v": "B777/B787/A330 preferred"
          }
        ],
        "note": "Foreign hires are accepted. Take-home pay may improve where the 30% ruling applies."
      }
    ],
    "recruitUrl": "https://careers.klm.com"
  },
  {
    "file": "swiss.html",
    "code": "LX",
    "color": "#E8122D",
    "nameEn": "Swiss International Air Lines (SWISS)",
    "subtitle": "Switzerland's international carrier and a member of the Lufthansa Group.",
    "tags": [
      {
        "cls": "tag-red",
        "label": "🇨🇭 Switzerland"
      },
      {
        "cls": "tag-blue",
        "label": "Star Alliance"
      },
      {
        "cls": "tag-gray",
        "label": "FSC"
      },
      {
        "cls": "tag-gold",
        "label": "Lufthansa Group"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "~90",
        "label": "Fleet Size"
      },
      {
        "val": "100+",
        "label": "Destinations"
      }
    ],
    "overview": [
      "Swiss International Air Lines (SWISS) is Switzerland's flag carrier and a member of the Lufthansa Group. With hubs at Zurich and Geneva, it serves more than 100 cities worldwide and is a member of Star Alliance. While Switzerland has a very high cost of living, pilot pay is also among the highest in Europe. Salaries denominated in CHF (Swiss francs) are very substantial when converted to JPY. It maintains high-quality training on par with Lufthansa."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Zurich, Switzerland"
      },
      {
        "k": "Hub",
        "v": "Zurich Airport (ZRH)"
      },
      {
        "k": "Alliance",
        "v": "Star Alliance"
      },
      {
        "k": "Founded",
        "v": "2002 (successor to the former Swissair)"
      },
      {
        "k": "Fleet Size",
        "v": "~90 aircraft"
      },
      {
        "k": "Income Tax",
        "v": "Applicable (varies by canton)"
      }
    ],
    "salaryNote": "Salaries are denominated in CHF (Swiss francs) and quoted pre-tax; conversion is roughly CHF/JPY ≈ 168 (rates fluctuate). Swiss income tax varies by canton (approximately 20–35%). First Officer pay follows a seniority-based system. Switzerland's cost of living is high, but pay is among the best in Europe.",
    "ops": {
      "routes": "From its Zurich and Geneva hubs, SWISS serves all of Europe, North America (New York, Chicago, Boston, etc.), Asia (Tokyo, Hong Kong, Singapore, etc.), and Africa and the Middle East.",
      "fleet": "Boeing 777-300ER, B787-9/10, Airbus A340-300 (scheduled for retirement), A321, and A220-100/300. Around 90 aircraft."
    },
    "training": [
      {
        "title": "Type Rating (EASA-approved ATO)",
        "body": "Type rating obtained at an EASA-approved Approved Training Organisation (ATO). Ground school → simulator (including MCC) → LIFUS."
      },
      {
        "title": "LIFUS (Line Training)",
        "body": "After obtaining the type rating, Line Flying Under Supervision is conducted with an instructor captain on board. Typically around 50–80 legs (per EASA FCL.060)."
      },
      {
        "title": "Recurrent Checks (OPC/LPC)",
        "body": "Proficiency Checks (PC) one to two times per year, to EASA FCL.625/735 standards. Overseen by each country's CAA (CAA UK / DGAC / LBA, etc.)."
      },
      {
        "title": "Captain Upgrade & Additional Ratings",
        "body": "After a period as SFO/Senior F/O, captain training follows. Additional qualifications such as LVP (Low Visibility Procedures), PBN, ETOPS, and RVSM are also obtained."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Staff Travel",
        "body": "Heavily discounted or free flight tickets for the employee and family. Also usable on alliance partner carriers."
      },
      {
        "icon": "🏥",
        "title": "Health Insurance",
        "body": "High-standard European health insurance. Loss-of-license insurance is also common."
      },
      {
        "icon": "💰",
        "title": "Bonus",
        "body": "Performance-linked bonus (equivalent to 2–4 months' pay per year). In some cases tied to performance appraisals."
      },
      {
        "icon": "📅",
        "title": "Paid Leave",
        "body": "25–35 days per year. Generous leave provisions under European labor law (EU directives)."
      },
      {
        "icon": "🏦",
        "title": "Retirement & Corporate Pension",
        "body": "Defined-benefit or defined-contribution corporate pension (DBP/DCP). Europe has a dual structure alongside the public pension."
      },
      {
        "icon": "🌐",
        "title": "Layover Allowance",
        "body": "Accommodation and per diem provided during overseas stays. Major European cities carry higher high-cost-area allowances."
      },
      {
        "icon": "🏔️",
        "title": "Living in Switzerland",
        "body": "One of Europe's safest and cleanest living environments, with an education system well-suited to bringing family (many English-language schools)."
      }
    ],
    "hiringStatus": "Recruitment is conducted via the Lufthansa Group; open to holders of an EASA ATPL.",
    "hiringColor": "#f5c842",
    "jobs": [
      {
        "title": "Captain / First Officer (Regular Recruitment)",
        "sub": "International operations. Zurich-based.",
        "status": "Check official site",
        "statusTag": "blue",
        "details": [
          {
            "k": "License",
            "v": "EASA ATPL (BAZL-certified)"
          },
          {
            "k": "English",
            "v": "ICAO Level 4 or above"
          },
          {
            "k": "Minimum flight hours",
            "v": "5,000h+ for Captain"
          },
          {
            "k": "German",
            "v": "Conversational level recommended"
          }
        ],
        "note": "In many cases hiring proceeds via the Lufthansa Group's integrated recruitment process."
      }
    ],
    "recruitUrl": "https://www.swiss.com/global/en/company/careers.html"
  },
  {
    "code": "IB",
    "color": "#CC0000",
    "file": "iberia.html",
    "nameEn": "Iberia",
    "subtitle": "Iberia — Spain's flag carrier · Oneworld member (IAG).",
    "tags": [
      {
        "cls": "tag-red",
        "label": "🇪🇸 Spain"
      },
      {
        "cls": "tag-blue",
        "label": "Oneworld (IAG)"
      },
      {
        "cls": "tag-gray",
        "label": "FSC"
      },
      {
        "cls": "tag-orange",
        "label": "No.1 Latin America Routes"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "~125",
        "label": "Fleet Size"
      },
      {
        "val": "150+",
        "label": "Destinations"
      }
    ],
    "overview": [
      "Founded in 1927, Iberia is Spain's flag carrier. From its hub at Madrid-Barajas, it serves Europe, the Americas (more than 20 cities across North, Central, and South America), North Africa, and the Middle East. It belongs to the Oneworld alliance and the IAG (International Airlines Group). Its Latin America network in particular ranks among the largest in the world. Spain's income tax reaches a maximum of 47%. The A320 family and the A350 form the backbone of its fleet."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Madrid, Spain"
      },
      {
        "k": "Hub",
        "v": "Madrid-Barajas Airport (MAD)"
      },
      {
        "k": "Alliance",
        "v": "Oneworld (IAG)"
      },
      {
        "k": "Founded",
        "v": "1927"
      },
      {
        "k": "Fleet Size",
        "v": "~125 aircraft"
      },
      {
        "k": "Income Tax",
        "v": "Yes (up to 47%)"
      }
    ],
    "salaryNote": "Pay is denominated in EUR and quoted pre-tax, and progresses on a seniority-based pay scale. Spain applies a progressive income tax reaching a maximum of 47%. Yen figures shown on the site are converted at EUR/JPY = 163. Madrid offers a relatively lower cost of living than many other major European cities.",
    "ops": {
      "routes": "From its Madrid hub, Iberia serves Latin America (more than 20 cities including Buenos Aires, Bogotá, Lima, and São Paulo), North America, all of Europe, North Africa, and the Middle East.",
      "fleet": "Airbus A350-900, A330-200/300, A321neo, A320neo, A319. About 125 aircraft."
    },
    "training": [
      {
        "title": "Type Rating (EASA-approved ATO)",
        "body": "Type rating obtained at an EASA-certified Approved Training Organisation (ATO). Ground school → simulator (including MCC) → LIFUS."
      },
      {
        "title": "LIFUS (Line Training)",
        "body": "After earning the type rating, pilots fly Line Flying Under Supervision alongside an instructor captain — typically around 50–80 legs (in line with EASA FCL.060)."
      },
      {
        "title": "Recurrent Checks (OPC/LPC)",
        "body": "Proficiency Checks (PC) held once or twice a year, to EASA FCL.625/735 standards. Overseen by national CAAs (CAA UK, DGAC, LBA, etc.)."
      },
      {
        "title": "Captain Upgrade & Additional Ratings",
        "body": "Captain training follows a period as SFO / Senior F/O. Additional qualifications such as LVP (Low Visibility Procedures), PBN, ETOPS, and RVSM are also obtained."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Staff Travel",
        "body": "Heavily discounted or free flights for employees and their families. Also usable on alliance partner airlines."
      },
      {
        "icon": "🏥",
        "title": "Medical Insurance",
        "body": "High-standard European medical insurance. Loss-of-license insurance is also common."
      },
      {
        "icon": "💰",
        "title": "Bonus",
        "body": "Performance-linked bonus (equivalent to 2–4 months' pay per year). In some cases tied to individual performance reviews."
      },
      {
        "icon": "📅",
        "title": "Paid Leave",
        "body": "25–35 days per year — a generous leave system backed by European labor law (EU directives)."
      },
      {
        "icon": "🏦",
        "title": "Retirement & Corporate Pension",
        "body": "Defined-benefit or defined-contribution corporate pension (DBP/DCP). In Europe this operates alongside the public pension in a two-tier structure."
      },
      {
        "icon": "🌐",
        "title": "Layover Allowance",
        "body": "Accommodation and per diems paid for overseas stays. High-cost-area allowances tend to be higher for major European cities."
      }
    ],
    "hiringStatus": "Recruiting on a regular basis. Open to EASA ATPL holders. Spanish-language ability is an advantage.",
    "hiringColor": "#34d399",
    "jobs": [
      {
        "title": "Captain & First Officer (Regular Intake)",
        "sub": "International operations. Madrid-based.",
        "status": "Recruiting",
        "statusTag": "green",
        "details": [
          {
            "k": "License",
            "v": "EASA ATPL (AESA-issued)"
          },
          {
            "k": "English",
            "v": "ICAO Level 4 or above"
          },
          {
            "k": "Minimum Flight Hours",
            "v": "5,000h+ for Captain"
          },
          {
            "k": "Spanish",
            "v": "Conversational to business level recommended"
          }
        ],
        "note": "Transfer and hiring opportunities also exist within the IAG group (British Airways, Vueling, etc.)."
      }
    ],
    "recruitUrl": "https://www.iberia.com/careers"
  },
  {
    "file": "finnair.html",
    "code": "AY",
    "color": "#003580",
    "nameEn": "Finnair",
    "subtitle": "Finnair — Finland's state-owned flag carrier · a bridge between Asia and Europe",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🇫🇮 Finland"
      },
      {
        "cls": "tag-blue",
        "label": "Oneworld"
      },
      {
        "cls": "tag-gray",
        "label": "FSC"
      },
      {
        "cls": "tag-gold",
        "label": "Northernmost Route"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "~80",
        "label": "Fleet Size"
      },
      {
        "val": "100+",
        "label": "Cities Served"
      }
    ],
    "overview": [
      "Finnair is Finland's state-owned flag carrier, founded in 1923. Based at its Helsinki hub, it is known for routes connecting Europe and Asia via the shortest paths over the Arctic Circle. It is a member of the Oneworld alliance. On its Asian routes (Tokyo, Osaka, Beijing, Seoul, etc.), the polar routing dramatically shortens flight times. The <strong>A350 is the mainstay of its long-haul fleet</strong>. Following the ban on flying over Russian airspace (in effect since 2022), the airline is currently reorganizing its route network."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Helsinki, Finland"
      },
      {
        "k": "Hub",
        "v": "Helsinki-Vantaa Airport (HEL)"
      },
      {
        "k": "Alliance",
        "v": "Oneworld"
      },
      {
        "k": "Founded",
        "v": "1923"
      },
      {
        "k": "Fleet Size",
        "v": "~80 aircraft"
      },
      {
        "k": "Income Tax",
        "v": "Yes (up to 51.5%)"
      }
    ],
    "salaryNote": "Salaries are denominated in EUR and quoted pre-tax (converted at EUR/JPY = 163). First Officer pay follows a seniority-based system. Finland's income tax reaches up to 51.5% (a Nordic high-welfare model), but this is offset by strong social security, including free education and healthcare.",
    "ops": {
      "routes": "From its Helsinki hub, Finnair serves Japan (Tokyo, Osaka, Nagoya), Asia (Beijing, Seoul, Bangkok, Shanghai, etc.), North America (New York, Los Angeles, etc.), and destinations across Europe. Its Arctic Circle routing delivers the shortest travel times.",
      "fleet": "Airbus A350-900, A330-300, A321LR, A320/A321neo. Approximately 80 aircraft."
    },
    "training": [
      {
        "title": "Type Rating (EASA-approved ATO)",
        "body": "Type rating obtained at an EASA-approved Approved Training Organisation (ATO). Ground school → simulator (including MCC) → LIFUS."
      },
      {
        "title": "LIFUS (Line Training)",
        "body": "After obtaining the type rating, Line Flying Under Supervision is conducted with an instructor captain on board. Typically around 50–80 legs (in accordance with EASA FCL.060)."
      },
      {
        "title": "Recurrent Checks (OPC/LPC)",
        "body": "Proficiency Checks (PC) once or twice per year, based on EASA FCL.625/735 standards. Overseen by the respective national CAAs (CAA UK, DGAC, LBA, etc.)."
      },
      {
        "title": "Captain Upgrade & Additional Ratings",
        "body": "After a period as SFO/Senior F/O, pilots undergo captain training. Additional qualifications such as LVP (Low Visibility Procedures), PBN, ETOPS, and RVSM are also obtained."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Staff Travel",
        "body": "Heavily discounted or free flight tickets for employees and their families. Also usable on alliance partner airlines."
      },
      {
        "icon": "🏥",
        "title": "Medical Insurance",
        "body": "High-standard European medical insurance. Loss-of-licence insurance is also common."
      },
      {
        "icon": "💰",
        "title": "Bonus",
        "body": "Performance-linked bonuses (equivalent to 2–4 months' pay per year). In some cases tied to performance evaluations."
      },
      {
        "icon": "📅",
        "title": "Paid Leave",
        "body": "25–35 days per year. A generous leave system under European labour law (EU directives)."
      },
      {
        "icon": "🏦",
        "title": "Retirement & Corporate Pension",
        "body": "Defined-benefit or defined-contribution corporate pension (DBP/DCP). In Europe this operates as a dual structure alongside the public pension."
      },
      {
        "icon": "🌐",
        "title": "Layover Allowance",
        "body": "Accommodation and per-diem allowances for overseas stays. Higher cost-of-living allowances apply in major European cities."
      },
      {
        "icon": "🌿",
        "title": "Nordic Welfare System",
        "body": "Finland's comprehensive public healthcare, education, and social security systems. One of Europe's finest environments for raising children."
      }
    ],
    "hiringStatus": "Regular recruitment ongoing. Open to holders of an EASA ATPL. Preference given to those with an A350 type rating.",
    "hiringColor": "#34d399",
    "jobs": [
      {
        "title": "Captain / First Officer (Regular Recruitment)",
        "sub": "International flight operations. Helsinki-based.",
        "status": "Now Hiring",
        "statusTag": "green",
        "details": [
          {
            "k": "Required License",
            "v": "EASA ATPL (Traficom-certified)"
          },
          {
            "k": "English",
            "v": "ICAO Level 4 or above"
          },
          {
            "k": "Minimum Flight Hours",
            "v": "Captain: 5,000h or more"
          },
          {
            "k": "Finnish Language",
            "v": "Not required (English-speaking workplace)"
          }
        ],
        "note": "Finnair has frequent traffic to and from Japan, making it a workplace well-suited to Japanese-speaking pilots."
      }
    ],
    "recruitUrl": "https://careers.finnair.com"
  },
  {
    "file": "virgin-atlantic.html",
    "code": "VS",
    "color": "#E2001A",
    "nameEn": "Virgin Atlantic",
    "subtitle": "Virgin Atlantic — the aviation arm of the Virgin Group, and a SkyTeam member.",
    "tags": [
      {
        "cls": "tag-red",
        "label": "🇬🇧 United Kingdom"
      },
      {
        "cls": "tag-blue",
        "label": "SkyTeam"
      },
      {
        "cls": "tag-gray",
        "label": "FSC"
      },
      {
        "cls": "tag-orange",
        "label": "Challenger"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "~37",
        "label": "Fleet Size"
      },
      {
        "val": "30+",
        "label": "Destinations"
      }
    ],
    "overview": [
      "Virgin Atlantic is a premium airline founded in 1984 by Richard Branson. With hubs at London Heathrow and Gatwick, it serves North America, the Caribbean, Asia and Africa, and joined SkyTeam in 2023. Championing the idea of an <strong>\"airline for people who love to fly,\"</strong> it places particular emphasis on the onboard experience and the diversity of its crew, operating an efficient fleet built around the A350 and B787."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Crawley, United Kingdom"
      },
      {
        "k": "Hub",
        "v": "Heathrow / Gatwick"
      },
      {
        "k": "Alliance",
        "v": "SkyTeam"
      },
      {
        "k": "Founded",
        "v": "1984"
      },
      {
        "k": "Fleet Size",
        "v": "Approx. 37 aircraft"
      },
      {
        "k": "Income Tax",
        "v": "Yes (top rate 45%)"
      }
    ],
    "salaryNote": "Salaries are quoted pre-tax and denominated in GBP, on a seniority-based scale (converted at GBP/JPY = 190). UK income tax applies at a top marginal rate of 45%. Against the backdrop of a pilot shortage, the airline has been stepping up its recruitment.",
    "ops": {
      "routes": "From London, the airline serves North America (New York, Los Angeles, Miami, etc.), the Caribbean, Africa (Lagos, Nairobi, etc.) and India. Its route network is more selectively curated than British Airways'.",
      "fleet": "Airbus A350-1000 and Boeing 787-9. Around 37 aircraft, specializing in highly efficient twin-engine types."
    },
    "training": [
      {
        "title": "Type-Rating Training (EASA-approved ATO)",
        "body": "Type rating obtained at an EASA-certified Approved Training Organisation (ATO). Ground school → simulator (including MCC) → LIFUS."
      },
      {
        "title": "LIFUS (Line Training)",
        "body": "After the type rating is completed, Line Flying Under Supervision is conducted with a training captain aboard — typically around 50–80 sectors (in accordance with EASA FCL.060)."
      },
      {
        "title": "Recurrent Checks (OPC/LPC)",
        "body": "One to two Proficiency Checks (PC) per year, per EASA FCL.625/735 standards. Supervised by the relevant national CAAs (UK CAA, DGAC, LBA, etc.)."
      },
      {
        "title": "Captain Upgrade & Additional Ratings",
        "body": "Captain training follows a period as SFO / Senior F/O. Additional qualifications such as LVP (Low Visibility Procedures), PBN, ETOPS and RVSM are also obtained."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Staff Travel",
        "body": "Heavily discounted or free tickets for employees and their families, also usable on alliance partner carriers."
      },
      {
        "icon": "🏥",
        "title": "Medical Insurance",
        "body": "High-standard European medical insurance. Loss-of-licence insurance is also common."
      },
      {
        "icon": "💰",
        "title": "Bonus",
        "body": "Performance-linked bonus (equivalent to 2–4 months' pay per year), in some cases tied to individual performance reviews."
      },
      {
        "icon": "📅",
        "title": "Paid Leave",
        "body": "25–35 days per year — a generous leave system underpinned by European labour law (EU directives)."
      },
      {
        "icon": "🏦",
        "title": "Retirement & Company Pension",
        "body": "A defined-benefit or defined-contribution company pension (DB/DC). In Europe this sits atop the state pension in a two-tier structure."
      },
      {
        "icon": "🌐",
        "title": "Layover Allowance",
        "body": "Accommodation and per-diem paid for overseas stays. Higher cost-of-living allowances apply in major European cities."
      },
      {
        "icon": "🎭",
        "title": "Diversity & Inclusion",
        "body": "As part of the Virgin Group culture, diverse hiring is prioritised, with an LGBTQ-friendly workplace."
      }
    ],
    "hiringStatus": "Regular intake underway. Open to UK CAA ATPL holders; A350 or B787 type-rating holders preferred.",
    "hiringColor": "#34d399",
    "jobs": [
      {
        "title": "Captain / First Officer (regular intake)",
        "sub": "International operations. London-based.",
        "status": "Hiring",
        "statusTag": "green",
        "details": [
          {
            "k": "License / Rating",
            "v": "UK CAA ATPL (or converted from EASA)"
          },
          {
            "k": "English",
            "v": "ICAO Level 4 or above"
          },
          {
            "k": "Min. Flight Hours",
            "v": "Captain 5,000h+"
          },
          {
            "k": "Type Rating",
            "v": "A350/B787 preferred"
          }
        ],
        "note": "Virgin is known for its unconventional hiring process, valuing individuality and a service-minded spirit."
      }
    ],
    "recruitUrl": "https://careers.virgin-atlantic.com"
  },
  {
    "file": "alaska-airlines.html",
    "code": "AS",
    "color": "#0060AB",
    "nameEn": "Alaska Airlines",
    "subtitle": "Alaska Airlines — the largest carrier on the U.S. West Coast · oneworld member.",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🇺🇸 USA"
      },
      {
        "cls": "tag-blue",
        "label": "oneworld"
      },
      {
        "cls": "tag-gray",
        "label": "FSC"
      },
      {
        "cls": "tag-gold",
        "label": "West Coast No.1"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "~350",
        "label": "Fleet Size"
      },
      {
        "val": "120+",
        "label": "Destinations"
      }
    ],
    "overview": [
      "Alaska Airlines is a major carrier based on the U.S. West Coast and in the state of Alaska, serving destinations across the United States, Canada, Mexico, Central and South America, and Hawaii. It is a member of <strong>oneworld</strong>. The airline operates Horizon Air as a subsidiary and expanded through its 2016 acquisition of Virgin America. It is in the process of transitioning to a unified fleet centered on the Boeing 737 MAX. Among the major U.S. carriers, it is known for its <strong>relatively stable financial position</strong>."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Seattle (USA)"
      },
      {
        "k": "Hub",
        "v": "Seattle–Tacoma International Airport (SEA)"
      },
      {
        "k": "Alliance",
        "v": "oneworld"
      },
      {
        "k": "Founded",
        "v": "1932"
      },
      {
        "k": "Fleet Size",
        "v": "~350 aircraft"
      },
      {
        "k": "Income Tax",
        "v": "Yes (federal top rate 37%)"
      }
    ],
    "salaryNote": "Figures are converted at USD/JPY = 150. Compensation is denominated in USD and quoted pre-tax, and is subject to U.S. federal income tax (top rate 37%) plus state tax. A new 2024 collective bargaining agreement raised captain compensation. Pay follows a seniority system; all figures are reference values based on industry standards.",
    "ops": {
      "routes": "Operates from West Coast hubs such as Seattle, San Francisco, and Portland to destinations throughout the United States, Alaska, Hawaii, Canada, Mexico, Central and South America, and Costa Rica.",
      "fleet": "Boeing 737-900/MAX 9, B737-800/MAX 8, and Airbus A319/A320/A321 (inherited from Virgin America). Approximately 350 aircraft."
    },
    "training": [
      {
        "title": "Type Rating Training (FAA-approved)",
        "body": "Type rating training conducted at an FAA-certified ATO (Approved Training Organization). Uses Part 142 training centers such as CAE and FlightSafety. Ground school → simulator → LOFT."
      },
      {
        "title": "IOE (Initial Operating Experience)",
        "body": "After obtaining the type rating, Initial Operating Experience is carried out accompanied by an instructor captain (Check Airman), typically around 25–50 legs."
      },
      {
        "title": "Recurrent Checks (PC/LOE)",
        "body": "A Proficiency Check (PC) or Line Operational Evaluation (LOE) conducted one to two times per year, in compliance with FAA Part 121/135."
      },
      {
        "title": "Upgrade to Captain",
        "body": "Primarily seniority-based. Requires meeting the necessary flight hours (typically 5,000–8,000+ hours) and passing a check administered by a Check Airman. An R-ATP (1,500 hours) program is available."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Staff Travel (Pass)",
        "body": "Pass travel for employees and their families — free or heavily discounted travel on Alaska's own flights and on partner carriers."
      },
      {
        "icon": "🏥",
        "title": "Medical, Dental & Vision Insurance",
        "body": "Comprehensive health insurance for employees and their families. Loss-of-license insurance is also commonly provided."
      },
      {
        "icon": "💰",
        "title": "401(k) Retirement Plan",
        "body": "A defined-contribution retirement plan (401(k)) with company matching; matching of up to 5–16% is common."
      },
      {
        "icon": "📅",
        "title": "Paid Time Off",
        "body": "Roughly 15–30 days per year (increasing with seniority), with flexible leave options such as trip flips and skips."
      },
      {
        "icon": "💵",
        "title": "Per Diem",
        "body": "A daily allowance on flying days (roughly $2–4 per hour), differing between domestic and international operations."
      },
      {
        "icon": "🌐",
        "title": "International Flight Allowance",
        "body": "Additional allowances and accommodation expenses for crew operating international flights."
      }
    ],
    "hiringStatus": "Regular hiring ongoing. Open to FAA ATP holders. U.S. work authorization required.",
    "hiringColor": "#34d399",
    "jobs": [
      {
        "title": "Captain / First Officer (Regular Hiring)",
        "sub": "Domestic and international operations. Seattle / Portland based.",
        "status": "Hiring",
        "statusTag": "green",
        "details": [
          {
            "k": "License",
            "v": "FAA ATP (1,500h) or R-ATP (1,000h)"
          },
          {
            "k": "English",
            "v": "Native or fluent"
          },
          {
            "k": "Min. Flight Hours",
            "v": "Captain 7,000h+ (guideline)"
          },
          {
            "k": "Work Eligibility",
            "v": "U.S. citizenship / permanent residency / work visa required"
          }
        ],
        "note": "Japanese nationals require a work visa (such as H-1B) or permanent residency. Competition for these positions is high."
      }
    ],
    "recruitUrl": "https://jobs.alaskaair.com"
  },
  {
    "file": "jetblue.html",
    "code": "B6",
    "color": "#003876",
    "nameEn": "JetBlue Airways",
    "subtitle": "A U.S. premium low-cost carrier that differentiates itself through in-flight comfort.",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🇺🇸 United States"
      },
      {
        "cls": "tag-orange",
        "label": "Hybrid LCC/ULCC"
      },
      {
        "cls": "tag-gray",
        "label": "Independent"
      },
      {
        "cls": "tag-gold",
        "label": "Value-focused"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "~280",
        "label": "Fleet Size"
      },
      {
        "val": "100+",
        "label": "Destinations"
      }
    ],
    "overview": [
      "JetBlue Airways is a U.S. premium low-cost carrier founded in 2000. Based out of New York (JFK/EWR) and Boston, it serves North America, the Caribbean, Latin America, and Europe (London, Amsterdam, and others). Every seat is fitted with a personal seatback screen and wider seating, differentiating the airline as a <strong>\"comfortable LCC.\"</strong> Merger negotiations with Spirit Airlines fell through in 2024. The A320 family and A220 form the core of its fleet."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "New York (USA)"
      },
      {
        "k": "Hub",
        "v": "JFK / Boston (BOS)"
      },
      {
        "k": "Alliance",
        "v": "None (independent)"
      },
      {
        "k": "Founded",
        "v": "2000"
      },
      {
        "k": "Fleet Size",
        "v": "~280 aircraft"
      },
      {
        "k": "Income Tax",
        "v": "Yes (federal top rate 37%)"
      }
    ],
    "salaryNote": "Salaries are USD-denominated and pre-tax, under a seniority-based pay structure. The top U.S. federal income tax rate is 37%. Note that New York has a high cost of living. (Figures converted at USD/JPY = 150.)",
    "ops": {
      "routes": "From the JFK and Boston hubs, JetBlue serves the U.S. East Coast, the Caribbean (over 50 cities), Latin America, the West Coast, and Europe (London, Amsterdam).",
      "fleet": "Airbus A321neo/XLR, A321ceo, A320ceo, A220-300. Approximately 280 aircraft."
    },
    "training": [
      {
        "title": "Type-Rating Training (FAA-approved)",
        "body": "Type-rating training at an FAA-certified ATO (Approved Training Organization). Part 142 training centers (CAE, FlightSafety, etc.) are used. Ground school → simulator → LOFT."
      },
      {
        "title": "IOE (Initial Operating Experience)",
        "body": "After obtaining the type rating, Initial Operating Experience is flown with a Check Airman (instructor captain) on board. Typically around 25–50 legs."
      },
      {
        "title": "Recurrent Checks (PC/LOE)",
        "body": "A Proficiency Check (PC) or Line Operational Evaluation (LOE) is conducted once or twice a year, compliant with FAA Part 121/135."
      },
      {
        "title": "FO-to-Captain Upgrade",
        "body": "Primarily seniority-based. Requires the necessary flight hours (typically 5,000–8,000+ hours) and passing a check by a Check Airman. An R-ATP (1,500-hour) route is available."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Staff Travel (Pass)",
        "body": "Pass travel for the employee and family. Free or heavily discounted travel on JetBlue and partner airlines."
      },
      {
        "icon": "🏥",
        "title": "Medical, Dental & Vision Insurance",
        "body": "Comprehensive medical insurance (employee and family). Loss-of-license insurance is also common."
      },
      {
        "icon": "💰",
        "title": "401(k) Retirement Plan",
        "body": "A defined-contribution 401(k) plan with company matching, commonly up to 5–16%."
      },
      {
        "icon": "📅",
        "title": "Paid Leave",
        "body": "Roughly 15–30 days per year (increasing with seniority). Flexible time-off options such as flip and skip are available."
      },
      {
        "icon": "💵",
        "title": "Per Diem",
        "body": "A daily allowance on flying days (around $2–4 per hour), which differs between domestic and international routes."
      },
      {
        "icon": "🌐",
        "title": "International Route Allowance",
        "body": "Additional allowances and lodging expenses for crew operating international routes."
      }
    ],
    "hiringStatus": "Recruiting on an ongoing basis. Open to FAA ATP holders. U.S. work authorization required.",
    "hiringColor": "#34d399",
    "jobs": [
      {
        "title": "Captain / First Officer (Ongoing Recruitment)",
        "sub": "Domestic and international operations. JFK/Boston based.",
        "status": "Recruiting",
        "statusTag": "green",
        "details": [
          {
            "k": "License",
            "v": "FAA ATP (1,500h)"
          },
          {
            "k": "English",
            "v": "Native or fluent"
          },
          {
            "k": "Minimum Flight Hours",
            "v": "Captain 7,000h+ (guideline)"
          },
          {
            "k": "Work Eligibility",
            "v": "U.S. citizenship / permanent residency / work visa required"
          }
        ],
        "note": "JetBlue is known for its distinctive, crew-focused corporate culture and high employee satisfaction."
      }
    ],
    "recruitUrl": "https://careers.jetblue.com"
  },
  {
    "file": "airdo.html",
    "code": "HD",
    "color": "#0055A4",
    "nameEn": "AIRDO (AIR DO)",
    "subtitle": "AIR DO — an independent full-service carrier connecting Hokkaido and Honshu.",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🇯🇵 Japan"
      },
      {
        "cls": "tag-navy",
        "label": "FSC"
      },
      {
        "cls": "tag-gray",
        "label": "ANA Codeshare"
      },
      {
        "cls": "tag-gray",
        "label": "Hokkaido"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "B737-700/800",
        "label": "Fleet"
      },
      {
        "val": "Launched 1998",
        "label": "Founded 1996"
      }
    ],
    "overview": [
      "AIRDO (AIR DO) is an independent <strong>full-service carrier</strong> based in Hokkaido, founded in 1996 and launched into service in 1998. With New Chitose Airport as its principal hub, it operates domestic routes linking Hokkaido with cities across Honshu, including Tokyo (Haneda), Osaka, Nagoya, Sendai and Asahikawa. It has strengthened its route network through codeshare and joint operations with ANA.",
      "Having overcome an earlier management crisis, the airline has now established a stable operating base. As the <strong>\"Wings of Hokkaido,\"</strong> it is a regionally rooted carrier that delivers the appeal of Hokkaido's nature, food and tourism. With the B737 series as its mainstay fleet, it has built a workplace where both veteran pilots and younger crew can thrive."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Sapporo, Hokkaido"
      },
      {
        "k": "Founded",
        "v": "1996 (launched 1998)"
      },
      {
        "k": "Hub",
        "v": "New Chitose Airport (CTS)"
      },
      {
        "k": "Joint Operation",
        "v": "Codeshare with ANA"
      },
      {
        "k": "Airline Type",
        "v": "FSC (independent)"
      },
      {
        "k": "Retirement Age",
        "v": "65 (Captain)"
      },
      {
        "k": "Fleet",
        "v": "Boeing 737-700 / 737-800"
      },
      {
        "k": "Income Tax",
        "v": "Japan — salaries quoted pre-tax"
      }
    ],
    "salaryNote": "As a Japanese carrier, salaries are quoted pre-tax and subject to standard Japanese income tax. Compensation includes a separately paid cold-climate allowance (with a winter add-on), a Hokkaido route allowance, and a performance-linked bonus paid 2–3 times per year. Loss-of-license insurance is provided, covering both on- and off-duty incidents. Monetary figures elsewhere on the site are shown in Japanese yen and can be switched to other currencies.",
    "ops": {
      "routes": "Main routes center on New Chitose–Tokyo (Haneda), Japan's largest air-travel-demand route, alongside New Chitose and Asahikawa to Osaka (Itami / Kansai), New Chitose to Nagoya (Chubu), and New Chitose to Sendai and Fukuoka, with nationwide reach leveraged through ANA codeshare flights. Operationally, AIRDO is equipped for winter snow, de-icing and low-visibility operations; runs efficient short-haul domestic services with the B737-700/800; concentrates high-frequency, high-volume flying on its core New Chitose–Haneda corridor; and plays a central role in supporting Hokkaido's tourism and business demand.",
      "fleet": "B737-700 (126 seats, short-haul variant); B737-800 (165 seats, standard variant); New Chitose Airport (CTS) as the hub base; and an ANA partnership operating codeshare flights."
    },
    "training": [
      {
        "title": "B737 Type Rating",
        "body": "Type-rating training for the Boeing 737-700/800 is conducted at AIRDO-certified facilities. The airline has a track record of accepting graduates of CAIJ (the former Civil Aviation College) as well as externally trained pilots. Trainees master glass-cockpit and FMS operation."
      },
      {
        "title": "Winter / Cold-Climate Training",
        "body": "Training to handle Hokkaido's distinctive winter weather. Pilots acquire cold-climate-specific skills, including operational decision-making in snow, on icy runways and in whiteout conditions, as well as de-icing procedures."
      },
      {
        "title": "ANA Collaboration Training",
        "body": "In line with joint operations with ANA, training is conducted to maintain consistency with ANA's standard operating procedures (SOPs), applying ANA-level safety and quality standards."
      },
      {
        "title": "Captain Upgrade & Recurrent Checks",
        "body": "After building experience as an F/O, pilots proceed to the captain-upgrade assessment. The environment makes early upgrade opportunities relatively accessible for mid-career pilots. Recurrent proficiency checks are carried out one to two times per year."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Flight Ticket Discounts",
        "body": "Discounted AIRDO tickets for employees and their families. ANA discounts can also be used on ANA codeshare flights."
      },
      {
        "icon": "🏥",
        "title": "Health Insurance & Medical Care",
        "body": "Enrollment in the company health-insurance union, pilot-specific health-management support, and full loss-of-license insurance coverage."
      },
      {
        "icon": "❄️",
        "title": "Hokkaido Posting Support",
        "body": "Cold-climate allowance and housing support, plus a Hokkaido lifestyle with ski resorts and great nature close at hand."
      },
      {
        "icon": "🏦",
        "title": "Retirement & Pension",
        "body": "A full retirement-allowance scheme and corporate pension, with benefits designed to reflect length of service."
      },
      {
        "icon": "👨‍👩‍👧",
        "title": "Childcare & Family-Care Leave",
        "body": "Full childcare-leave and reduced-hours systems in place. Male pilots have a track record of taking childcare leave."
      },
      {
        "icon": "📚",
        "title": "Training Cost Support",
        "body": "Type-rating training costs are borne by AIRDO, with a cost-support system for continuing education and skill development."
      }
    ],
    "hiringStatus": "Experienced hires (F/O & Captain) — availability varies by period; check the official site",
    "jobs": [
      {
        "title": "AIRDO Pilot Recruitment",
        "sub": "First Officer (F/O) / Captain — experienced-hire recruitment",
        "status": "Check official site",
        "statusTag": "gray",
        "details": [
          {
            "k": "Eligibility",
            "v": "Holder of a CPL (multi-engine, instrument) or an ATPL"
          },
          {
            "k": "Location",
            "v": "New Chitose Airport (Hokkaido)"
          },
          {
            "k": "English",
            "v": "Aviation English Proficiency Certificate, Level 4 or above"
          }
        ],
        "note": "Hiring availability varies by period; please check the AIRDO official site."
      },
      {
        "title": "General Application Requirements",
        "sub": "Baseline eligibility criteria for pilot applicants",
        "status": "Reference",
        "statusTag": "blue",
        "details": [
          {
            "k": "License",
            "v": "CPL (Airplane, Multi-Engine Land) or higher"
          },
          {
            "k": "Rating",
            "v": "Instrument Rating held"
          },
          {
            "k": "Medical",
            "v": "Class 1 Aviation Medical certificate"
          },
          {
            "k": "English",
            "v": "Aviation English Proficiency Certificate, Level 4 or above"
          },
          {
            "k": "Disposition",
            "v": "Willingness to work in Hokkaido and adapt to a cold-climate environment"
          }
        ],
        "note": ""
      }
    ],
    "recruitUrl": "https://www.airdo.jp/company/recruit/"
  },
  {
    "file": "airjapan.html",
    "code": "NQ",
    "color": "#0090CC",
    "nameEn": "AirJapan",
    "subtitle": "Air Japan — the ANA Group's medium-haul LCC, expanding across Southeast Asian routes.",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🇯🇵 Japan"
      },
      {
        "cls": "tag-cyan",
        "label": "ANA Group"
      },
      {
        "cls": "tag-gray",
        "label": "Medium-haul LCC"
      },
      {
        "cls": "tag-gold",
        "label": "Launched 2024"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "Boeing 787-8",
        "label": "Fleet type"
      },
      {
        "val": "Launched 2024",
        "label": "Founded 2022"
      }
    ],
    "overview": [
      "AirJapan is a <strong>medium-haul LCC (middle-cost carrier)</strong> within the ANA Group, established in 2022. It began operations in February 2024 on the Narita↔Seoul (Incheon) and Narita↔Bangkok (Suvarnabhumi) routes, and subsequently expanded to Southeast Asian routes such as Vietnam and Bangkok. Within the ANA Group it differentiates itself as a \"medium-haul LCC\" positioned between ANA (a full-service carrier) and Peach (a short-haul LCC).",
      "It operates the <strong>Boeing 787-8 (Dreamliner)</strong>, offering relatively comfortable seating and in-flight service despite being an LCC. Based at Narita Airport, it is a new-generation airline specializing in medium-haul international routes that complement the ANA Group network. For pilots, it is an attractive option that offers flying experience on the state-of-the-art B787 and the chance to build an international-route career."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Narita City, Chiba (Narita Airport)"
      },
      {
        "k": "Founded / Launched",
        "v": "Founded 2022, launched 2024"
      },
      {
        "k": "Hub",
        "v": "Narita International Airport (NRT)"
      },
      {
        "k": "Group",
        "v": "ANA Group"
      },
      {
        "k": "Airline type",
        "v": "Medium-haul LCC"
      },
      {
        "k": "Callsign",
        "v": "NQ (Air Japan)"
      }
    ],
    "salaryNote": "Compensation follows ANA Group pay regulations. Bonuses are paid 2–3 times per year on the ANA Group standard, and First Officer pay includes international-route allowances. Overseas layover allowances are paid separately according to destination-city rank (Seoul, Bangkok, Hanoi, etc.). Loss-of-license insurance covering both on- and off-duty is provided. Salaries are paid in Japanese yen and are subject to Japanese income tax; any figures shown elsewhere are pre-tax.",
    "ops": {
      "routes": "Routes (as of 2026): Narita↔Seoul (Incheon) on the Korea route; Narita↔Bangkok (Suvarnabhumi) on the Thailand route; and Narita↔Hanoi / Ho Chi Minh on the Vietnam routes, with a phased rollout of further Southeast Asian routes planned. As a medium-haul LCC, its operations are characterized by 5–8 hour medium-haul international flights, the B787's advanced cockpit and latest avionics, an international-only operating model based at Narita, and the ANA Group's support structure and maintenance standards.",
      "fleet": "Boeing 787-8 (Dreamliner). Based at Narita (NRT hub), the airline focuses on medium-haul international routes with a Southeast Asia emphasis — a newly launched operation that started in 2024."
    },
    "training": [
      {
        "title": "ANA Group training standards",
        "body": "Aligned with the ANA Group's unified training framework. B787 type-rating training is conducted using the same facilities and standards as ANA mainline, applying a world-class safety training program."
      },
      {
        "title": "Boeing 787-8 type rating training",
        "body": "Type-rating training on the cutting-edge Dreamliner (B787). Pilots gain in-depth mastery of B787-specific systems such as its electrical systems, composite airframe, and latest avionics."
      },
      {
        "title": "International & overseas operations training",
        "body": "Covers ICAO-standard international operating procedures, operational knowledge for overseas airports, and English-language ATC communication — the skills required of an international-route pilot."
      },
      {
        "title": "Recurrent checks & continuing training",
        "body": "Proficiency checks once or twice a year. As a startup airline, it offers a fast-paced upgrade system and an environment in which pilots can build their careers."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "ANA Group flight discounts",
        "body": "Discounted ANA Group tickets for the pilot and family. Discounts are also available across Star Alliance carriers."
      },
      {
        "icon": "🌏",
        "title": "Overseas layover allowance",
        "body": "Layover allowances for overseas cities tied to international flying, set by city rank such as Seoul, Bangkok, and Hanoi."
      },
      {
        "icon": "🏥",
        "title": "Health insurance & medical",
        "body": "Enrollment in the ANA Group health insurance society. Pilot-specific health management and loss-of-license insurance are fully provided."
      },
      {
        "icon": "🚀",
        "title": "Startup growth opportunity",
        "body": "Early upgrade opportunities unique to a newly established airline. Active expansion of positions is expected during the growth phase."
      },
      {
        "icon": "👨‍👩‍👧",
        "title": "Childcare & family-care leave",
        "body": "Childcare leave and reduced-hours work programs. Comprehensive childcare and nursing-care support based on ANA Group standards."
      },
      {
        "icon": "📚",
        "title": "Training cost support",
        "body": "B787 type-rating training costs are covered by AirJapan. A cost-support program is provided for continuing training and skill development."
      }
    ],
    "hiringStatus": "Actively hiring",
    "hiringColor": "#34d399",
    "jobs": [
      {
        "title": "AirJapan Pilot Recruitment",
        "sub": "First Officer (F/O) / Captain — B787-experienced or intra-ANA-Group transfer",
        "status": "Actively hiring",
        "statusTag": "green",
        "details": [
          {
            "k": "Eligibility",
            "v": "Holder of an Airline Transport Pilot License (ATPL), or an intra-ANA-Group transfer"
          },
          {
            "k": "Base",
            "v": "Narita International Airport (Chiba)"
          },
          {
            "k": "English",
            "v": "Aviation English Proficiency certificate Level 4+ (Level 5 recommended for international routes)"
          }
        ],
        "note": "As a recently launched airline, hiring volume is trending upward. Please confirm details on the ANA Group recruitment page or the official AirJapan website."
      },
      {
        "title": "General Application Requirements",
        "sub": "Baseline qualifications for pilot applicants",
        "status": "Requirements",
        "statusTag": "gray",
        "details": [
          {
            "k": "License",
            "v": "Airline Transport Pilot License (Airplane, Multi-engine Land)"
          },
          {
            "k": "Instrument",
            "v": "Instrument rating and IFR operating experience"
          },
          {
            "k": "Medical",
            "v": "First-class aviation medical certificate"
          },
          {
            "k": "English",
            "v": "English proficiency (Aviation English Proficiency Level 4+; strong English preferred for international operations)"
          },
          {
            "k": "Aptitude",
            "v": "Motivation for international flying and adaptability to overseas cultures"
          }
        ],
        "note": ""
      }
    ],
    "recruitUrl": "https://www.ana.co.jp/group/company/anawings/recruit/"
  },
  {
    "file": "amx.html",
    "code": "MZ",
    "color": "#00843D",
    "nameEn": "Amakusa Airlines (AMX)",
    "subtitle": "Amakusa Airlines — Japan's smallest carrier, the wings of Amakusa flying on a single aircraft.",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🇯🇵 Japan"
      },
      {
        "cls": "tag-amx",
        "label": "FSC"
      },
      {
        "cls": "tag-gray",
        "label": "JAL/ANA Partnership"
      },
      {
        "cls": "tag-gold",
        "label": "Single-Aircraft Operation"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "ATR 42-600",
        "label": "Fleet (1 aircraft)"
      },
      {
        "val": "Launched 2000",
        "label": "Founded 1998"
      }
    ],
    "overview": [
      "Amakusa Airlines (AMX) was founded in 1998 and began operations in 2000. Based in Amakusa City, Kumamoto Prefecture, its defining feature is that it runs its route network on a <strong>single aircraft</strong> — a scale of operation unmatched by any other airline in Japan. It owns and operates just one ATR 42-600, serving the Amakusa–Fukuoka, Amakusa–Kumamoto, and Amakusa–Osaka (Itami) routes.",
      "The airline codeshares with both JAL and ANA, another rarity among Japanese carriers. Departing from and arriving at Amakusa Airport — surrounded by the beautiful seas and nature of the Amakusa region — its routes play a vital role as tourism, medical, and everyday-life infrastructure for the area. It is a workplace with a strong sense of purpose and reward, where a small, elite team maintains the widest possible network with a single aircraft."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Amakusa City, Kumamoto Prefecture"
      },
      {
        "k": "Founded / Launched",
        "v": "Founded 1998 · Launched 2000"
      },
      {
        "k": "Hub",
        "v": "Amakusa Airport (AXJ)"
      },
      {
        "k": "Codeshare",
        "v": "JAL & ANA (both carriers)"
      },
      {
        "k": "Airline Type",
        "v": "FSC (Commuter)"
      },
      {
        "k": "Fleet Size",
        "v": "1 aircraft (ATR 42-600)"
      }
    ],
    "salaryNote": "Bonuses are paid twice a year, set to the standards of a company funded by local government. A separate regional allowance is paid for the Amakusa posting, and flight (duty) allowances apply on top of base pay. Loss-of-license insurance is fully provided, covering both on-duty and off-duty cases. All figures are in Japanese yen (¥).",
    "ops": {
      "routes": "Main routes: Amakusa–Fukuoka (approx. 30 min), Amakusa–Kumamoto (approx. 20 min), and Amakusa–Osaka/Itami (approx. 70 min), with schedule management pushed to its limits on a single-aircraft setup. Single-aircraft operation carries distinctive demands: keeping the airframe in top condition is the paramount priority; pilots must make immediate decisions and respond when schedules slip; high adaptability to Amakusa's characteristic maritime weather is essential; and the dual codeshare with both JAL and ANA must be managed simultaneously.",
      "fleet": "One ATR 42-600 (48 seats) operated as a single-aircraft fleet, based at Amakusa Airport (AXJ). AMX is the only carrier in Japan with a dual JAL/ANA codeshare arrangement, and its smallest-scale operation in Japan makes it a genuinely unique presence."
    },
    "training": [
      {
        "title": "ATR 42-600 Type Rating",
        "body": "Type-rating training is conducted on the ATR 42-600, the latest model of this French-built turboprop, covering its glass cockpit and up-to-date avionics. Training also includes sessions at ATR-certified facilities."
      },
      {
        "title": "Training Unique to Single-Aircraft Operation",
        "body": "Pilots sharpen the ability to make immediate decisions based on the maintenance status of the sole airframe and on changing weather. With no backup aircraft available, a high level of risk management and CRM skill is required."
      },
      {
        "title": "Amakusa & Over-Water Flight Training",
        "body": "Training to handle the maritime weather of the Amakusa Sea and the Shiranui Sea, and to master precision landings on Amakusa Airport's unusual terrain and short runway. Sound judgment during typhoon season is also important."
      },
      {
        "title": "Captain Upgrade & Periodic Checks",
        "body": "Because the team is small and elite, upgrade to captain tends to come relatively early. Safety standards are maintained through proficiency checks one to two times a year, within a close-knit environment where all staff work closely together."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Air Ticket Discounts",
        "body": "Discounted AMX tickets for employees and their families. JAL and ANA discounts can also be used, subject to partnership terms."
      },
      {
        "icon": "🌊",
        "title": "The Appeal of Life in Amakusa",
        "body": "Amakusa's beautiful sea, dolphin watching, and fresh seafood — a fulfilling lifestyle amid rich natural surroundings."
      },
      {
        "icon": "🏥",
        "title": "Health Insurance & Medical Care",
        "body": "Membership in the health insurance society, with health-management support tailored to pilots. Loss-of-license insurance is fully provided."
      },
      {
        "icon": "🏦",
        "title": "Retirement Allowance & Pension",
        "body": "A full retirement allowance scheme, built on the stable corporate foundation funded by Kumamoto Prefecture and Amakusa City."
      },
      {
        "icon": "👨‍👩‍👧",
        "title": "The Bond of a Small Airline",
        "body": "The homelike workplace atmosphere that only Japan's smallest airline can offer — a strong sense of solidarity where all staff know one another."
      },
      {
        "icon": "📚",
        "title": "Training Cost Support",
        "body": "Type-rating training costs are covered by AMX. Because the team is small and elite, individualized support is extensive."
      }
    ],
    "hiringStatus": "As of March 2026 — rare openings, check official site",
    "hiringColor": "#f5c842",
    "jobs": [
      {
        "title": "Amakusa Airlines Pilot Recruitment",
        "sub": "First Officer (F/O) / Captain — experienced hire (rare positions due to single-aircraft operation)",
        "status": "Check official site",
        "statusTag": "gray",
        "details": [
          {
            "k": "Eligibility",
            "v": "Commercial Pilot License (multi-engine, instrument) or Airline Transport Pilot License holder"
          },
          {
            "k": "Work Location",
            "v": "Amakusa Airport (Amakusa City, Kumamoto Prefecture)"
          },
          {
            "k": "English Requirement",
            "v": "Aviation English Proficiency Certificate, Level 4 or above"
          }
        ],
        "note": "Because the airline operates a single aircraft, openings are extremely limited and arise only when a vacancy occurs. Check the official AMX website regularly for hiring status. Those aspiring to work at Amakusa Airlines may in some cases be able to reach out by inquiry alone."
      },
      {
        "title": "General Application Requirements",
        "sub": "",
        "status": "Requirements",
        "statusTag": "blue",
        "details": [
          {
            "k": "License",
            "v": "Commercial Pilot License (Airplane, Multi-Engine Land) or above"
          },
          {
            "k": "Instrument",
            "v": "Instrument Flight Rating held"
          },
          {
            "k": "Medical",
            "v": "First-Class Aviation Medical Certificate"
          },
          {
            "k": "English",
            "v": "Aviation English Proficiency Certificate, Level 4 or above"
          },
          {
            "k": "Mindset",
            "v": "A strong sense of mission for Amakusa and remote-island regional aviation, plus teamwork"
          }
        ],
        "note": ""
      }
    ],
    "recruitUrl": "https://www.amx.co.jp/company/recruit/"
  },
  {
    "file": "ana-wings.html",
    "code": "EH",
    "color": "#1A6EB5",
    "nameEn": "ANA Wings",
    "subtitle": "The ANA Group's flagship commuter carrier serving Japan's domestic regional routes.",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🇯🇵 Japan"
      },
      {
        "cls": "tag-ana",
        "label": "ANA Group"
      },
      {
        "cls": "tag-gray",
        "label": "FSC"
      },
      {
        "cls": "tag-gray",
        "label": "Star Alliance"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "DHC-8 / B737",
        "label": "Fleet"
      },
      {
        "val": "2010",
        "label": "Founded (merger)"
      }
    ],
    "overview": [
      "ANA Wings is a commuter and regional airline of the ANA Group, established in 2010 through the merger of the former Air Next and the former ANA Wings (formerly Air Next / Air Next Co., Ltd.). With Tokyo Haneda Airport as its primary base, it handles regional routes across the whole of Japan. A defining feature is its two-track fleet configuration — the DHC-8-Q400 covering local routes and the B737-700/800 supplementing trunk-line services.",
      "As a member of the ANA Group, it supports the domestic regional route network while maintaining Star Alliance service standards. A variety of career paths are available, including transfers from mainline ANA and in-house pilot training (self-sponsored cadet program), making it a regional carrier that serves as a stepping stone for career advancement within the ANA Group."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Ota City, Tokyo (within Haneda Airport)"
      },
      {
        "k": "Founded",
        "v": "2010 (merger)"
      },
      {
        "k": "Hub",
        "v": "Tokyo Haneda (HND)"
      },
      {
        "k": "Group",
        "v": "ANA Group"
      },
      {
        "k": "Alliance",
        "v": "Star Alliance"
      },
      {
        "k": "Retirement Age",
        "v": "65 (Captain)"
      }
    ],
    "salaryNote": "Pay is governed by ANA Group regulations and varies by aircraft type. In addition to base pay, pilots receive a per-flight-hour flight (duty) allowance and a separately paid layover allowance for overnight operations. Bonuses are paid two to three times a year under ANA Group standards, and loss-of-license insurance (covering both on-duty and off-duty) is provided. All figures are yen-denominated and subject to Japanese income tax.",
    "ops": {
      "routes": "ANA Wings runs a two-track network from its Haneda base. The DHC-8-Q400 (roughly 80-seat turboprop) covers local routes into smaller regional airports — for example Haneda to Tajima and Oki, and Itami/Chubu to Izumo, Hagi-Iwami and similar destinations — as well as point-to-point regional services that meet demand as an alternative to the Shinkansen, all operated efficiently with the turboprop. The B737-700/800 supplements trunk routes such as Haneda to Okinawa and Hokkaido, flying as ANA codeshare services. Pilots can qualify on both jet and propeller types and build flying experience across a diverse mix of routes and equipment covering both regional and trunk operations.",
      "fleet": "DHC-8-Q400 (about 80-seat turboprop) for local routes and B737-700/800 jets supplementing trunk routes; based at the Haneda (HND) hub with a nationwide network spanning both regional and trunk services."
    },
    "training": [
      {
        "title": "ANA Group Training Standards",
        "body": "Conducted in line with the ANA Group's common training framework. Ground school, simulator and aircraft training are carried out to the same high safety standards as mainline ANA."
      },
      {
        "title": "Multiple Type-Rating Training",
        "body": "There are also career paths that allow you to earn type ratings on both the DHC-8-Q400 and the B737. Experience on both turboprops and jets is a major asset for a pilot."
      },
      {
        "title": "Transfer Opportunities to ANA",
        "body": "After building a track record and experience at ANA Wings, there are opportunities to transfer to mainline ANA. A clear path for career advancement within the group is firmly in place."
      },
      {
        "title": "Recurrent Checks & Continuation Training",
        "body": "Proficiency checks (simulator) once or twice a year. As part of the ANA Group, ongoing maintenance of safety and technical standards is mandatory."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "ANA Group Flight Ticket Discounts",
        "body": "Discounted ANA Group airfares for employees and their families. Discounts across Star Alliance member carriers can also be used."
      },
      {
        "icon": "🏥",
        "title": "Health Insurance & Medical Care",
        "body": "Enrollment in the ANA Group health insurance association. A dedicated pilot health-management and medical-support system is fully in place."
      },
      {
        "icon": "🏦",
        "title": "Retirement Allowance & Pension",
        "body": "ANA Group-standard retirement allowance and corporate pension, with generous benefits designed around length of service."
      },
      {
        "icon": "🏠",
        "title": "Housing Support",
        "body": "Company housing and dormitory programs plus a housing allowance. Relocation cost support is provided when base assignments change."
      },
      {
        "icon": "👨‍👩‍👧",
        "title": "Childcare & Family-Care Leave",
        "body": "Full childcare-leave and reduced-hours programs. Male pilots have a track record of taking childcare leave, and family-care leave is also in place."
      },
      {
        "icon": "🚀",
        "title": "Career Path to Mainline ANA",
        "body": "A transfer program from ANA Wings to mainline ANA. Career advancement within the group makes it possible to step up to larger aircraft and international routes."
      }
    ],
    "hiringStatus": "Check official site (as of March 2026)",
    "jobs": [
      {
        "title": "ANA Wings Pilot Recruitment",
        "sub": "First Officer (F/O) — experienced-hire and internal ANA Group transfer",
        "status": "Check official site",
        "statusTag": "gray",
        "details": [
          {
            "k": "Eligibility",
            "v": "Holders of a Commercial Pilot License (multi-engine, instrument), or internal ANA Group transfer"
          },
          {
            "k": "Base",
            "v": "Tokyo Haneda Airport (main base) and others"
          },
          {
            "k": "English",
            "v": "Aviation English Proficiency Level 4 or above"
          }
        ],
        "note": "Recruitment status varies by period. Please check the ANA Group careers page or the official ANA Wings website."
      },
      {
        "title": "General Application Requirements",
        "sub": "Baseline eligibility for pilot applicants",
        "status": "Reference",
        "statusTag": "gray",
        "details": [
          {
            "k": "License",
            "v": "Commercial Pilot License (airplane, multi-engine land)"
          },
          {
            "k": "Instrument Rating",
            "v": "Instrument rating held"
          },
          {
            "k": "Medical",
            "v": "Class 1 aviation medical certificate"
          },
          {
            "k": "English",
            "v": "English proficiency (Aviation English Proficiency Level 4 or above recommended)"
          },
          {
            "k": "Fitness",
            "v": "Physically and mentally healthy"
          }
        ],
        "note": ""
      }
    ],
    "recruitUrl": "https://www.ana.co.jp/group/company/anawings/recruit/"
  },
  {
    "file": "daiichi-air.html",
    "code": "第一",
    "color": "#0066CC",
    "nameEn": "Daiichi Aviation (Daiichi Air)",
    "subtitle": "Daiichi Aviation — a small-aircraft commuter carrier linking Okinawa's remote islands.",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🇯🇵 Japan"
      },
      {
        "cls": "tag-d1",
        "label": "Commuter"
      },
      {
        "cls": "tag-gray",
        "label": "Okinawa Remote Islands"
      },
      {
        "cls": "tag-gray",
        "label": "Small Aircraft"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "C208B / BN-2",
        "label": "Fleet"
      },
      {
        "val": "Est. 2005",
        "label": "Naha Base"
      }
    ],
    "overview": [
      "Daiichi Aviation (which has operated under its current name since 2005) is an independent commuter airline based in Naha City, Okinawa Prefecture. Using ultra-small aircraft such as the Cessna 208B Grand Caravan and the Britten-Norman BN-2 Islander, it operates commuter routes from Okinawa's main island to remote islands such as Aguni Island.",
      "It is an airline that protects Okinawa's lifeline, specializing in the ultra-small-scale remote-island routes that major carriers do not serve. Because it is a very small organization, pilots work as the core of the company. Flying experience on small aircraft — and in particular the varied landing experience gained on single-engine and ultra-small twin-engine types — contributes greatly to improving <strong>fundamental flying skills</strong>."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Naha City, Okinawa Prefecture"
      },
      {
        "k": "Founded",
        "v": "2005 (current company name)"
      },
      {
        "k": "Hub",
        "v": "Around Naha Airport (OKA)"
      },
      {
        "k": "Group",
        "v": "Independent"
      },
      {
        "k": "Airline Type",
        "v": "FSC (small-aircraft commuter)"
      },
      {
        "k": "Destinations",
        "v": "Okinawa remote islands (Aguni, etc.)"
      }
    ],
    "salaryNote": "Pay is denominated in Japanese yen and subject to Japanese income tax. Pilots receive a per-flight flight (duty) allowance (roughly ¥4,000–¥5,500 per flight for captains and ¥2,500–¥3,500 for first officers), plus a separate remote-island allowance set individually by route. Bonuses are paid twice a year on an independent-company standard, and loss-of-license insurance is provided, covering both on-duty and off-duty incidents.",
    "ops": {
      "routes": "Main routes center on the Okinawa ↔ Aguni Island service (flown by the C208B and BN-2), along with commuter routes between Okinawa's remote islands, charter and special-transport operations, and support for remote-island medical and emergency-supply transport. Flying characteristics reflect ultra-small aircraft operation: precision flying on aircraft of nine seats or fewer, high adaptability to Okinawa's maritime weather and typhoons, precision landings on ultra-short runways and narrow airfields, and a strong sense of mission as a lifeline for island residents.",
      "fleet": "Cessna 208B Grand Caravan (9-seat single-engine turboprop) and Britten-Norman BN-2 Islander (9-seat twin-engine piston), operated from a Naha (OKA) base as a remote-island specialist within Okinawa Prefecture."
    },
    "training": [
      {
        "title": "C208B & BN-2 Type-Rating Training",
        "body": "Type-rating training on the Cessna 208B Grand Caravan (single-engine turboprop) and the BN-2 Islander (twin-engine piston). By mastering different powerplants and systems, pilots build a diverse skill set."
      },
      {
        "title": "Okinawa Ultra-Small Remote-Island Training",
        "body": "Precision-landing training at ultra-small-scale airports such as Aguni Island. Decision-making training under the influence of Okinawa's distinctive maritime weather and typhoons. Pilots acquire STOL landing techniques on ultra-short runways."
      },
      {
        "title": "Small, Elite-Team Training",
        "body": "Because the company is small, there is abundant direct instruction from captains. Beyond flying skills, pilots gain hands-on knowledge across a broad range of aviation areas — including aircraft maintenance, ground operations, and flight dispatch."
      },
      {
        "title": "Captain Upgrade & Recurrent Checks",
        "body": "The high number of flights and landings on small aircraft directly builds airmanship. Safety standards are maintained through recurrent checks once or twice a year, and the environment is set up for early upgrade to captain."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Airline Ticket Discounts",
        "body": "Discounted air tickets for employees and their families, making Okinawa's remote-island travel easy to enjoy."
      },
      {
        "icon": "🌺",
        "title": "Okinawa Living Support",
        "body": "Based in Naha, pilots enjoy Okinawa's rich nature, culture, and cuisine every day, fully savoring a tropical lifestyle."
      },
      {
        "icon": "🏥",
        "title": "Health Insurance & Medical Care",
        "body": "Enrollment in the company health insurance association, pilot-specific health-management support, and full loss-of-license insurance."
      },
      {
        "icon": "🏦",
        "title": "Retirement Allowance & Pension",
        "body": "A fully established retirement-allowance program. As a stable independent company, it supports long-term careers."
      },
      {
        "icon": "🎓",
        "title": "Broad Flying-Skill Development",
        "body": "Experience across many aircraft types — single- and twin-engine, turboprop and piston — an environment that firmly strengthens the fundamentals of being a pilot."
      },
      {
        "icon": "📚",
        "title": "Training-Cost Support",
        "body": "Type-rating training costs are covered by Daiichi Aviation, with support programs for acquiring and maintaining qualifications across multiple aircraft types."
      }
    ],
    "hiringStatus": "Recruiting — check official site (as of March 2026)",
    "jobs": [
      {
        "title": "Daiichi Aviation Pilot Recruitment",
        "sub": "Captain / First Officer (F/O) — hiring experienced small-aircraft pilots",
        "status": "Check official site",
        "statusTag": "gray",
        "details": [
          {
            "k": "Eligibility",
            "v": "Holder of a Commercial Pilot License (single- or multi-engine, instrument)"
          },
          {
            "k": "Location",
            "v": "Around Naha Airport, Okinawa Prefecture"
          },
          {
            "k": "English Requirement",
            "v": "Aviation English Proficiency Certificate, Level 4 or above"
          }
        ],
        "note": "Hiring status varies by period; please confirm on Daiichi Aviation's official site. Applicants with a passion for small aircraft and remote-island routes are welcome."
      },
      {
        "title": "General Application Requirements",
        "sub": "Baseline qualifications expected of pilot applicants",
        "status": "Requirements",
        "statusTag": "gray",
        "details": [
          {
            "k": "License",
            "v": "Commercial Pilot License (airplane, single- or multi-engine land)"
          },
          {
            "k": "Instrument",
            "v": "Instrument rating (preferred)"
          },
          {
            "k": "Medical",
            "v": "Class 1 aviation medical certificate"
          },
          {
            "k": "English",
            "v": "English proficiency (Aviation English Certificate, Level 4 or above)"
          },
          {
            "k": "Mindset",
            "v": "A strong sense of mission for Okinawa remote-island and commuter routes"
          }
        ],
        "note": ""
      }
    ],
    "recruitUrl": ""
  },
  {
    "file": "eagle-jet.html",
    "code": "EJI",
    "color": "#5ec4ff",
    "nameEn": "Eagle Jet International, Inc.",
    "subtitle": "Eagle Jet International, Inc. — a Europe-based charter operator that hires low-hour pilots.",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🇪🇺 Europe"
      },
      {
        "cls": "tag-gray",
        "label": "Charter"
      },
      {
        "cls": "tag-green",
        "label": "Low-hour pilots welcome"
      },
      {
        "cls": "tag-orange",
        "label": "Contract hiring"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "A320",
        "label": "Aircraft"
      },
      {
        "val": "Europe",
        "label": "Region"
      }
    ],
    "overview": [
      "Eagle Jet International is a Europe-based charter operator. For its A320 First Officer positions, it runs a distinctive hiring program in which EASA license holders who have not yet obtained the type rating — including low-hour pilots — are eligible to apply. For pilots straight out of training who want to build airline route experience, this is a valuable opportunity. Employment is on a contract basis (freelance included)."
    ],
    "facts": [
      {
        "k": "Business Type",
        "v": "Charter operator"
      },
      {
        "k": "Region",
        "v": "Europe"
      },
      {
        "k": "Fleet",
        "v": "Airbus A320"
      },
      {
        "k": "Employment Type",
        "v": "Contract (Contract/Freelance)"
      },
      {
        "k": "Hiring Feature",
        "v": "Low-hour and non-type-rated pilots welcome"
      },
      {
        "k": "Apply To",
        "v": "info@eaglejet.com"
      }
    ],
    "salaryNote": "Because employment is on a contract basis, annual earnings depend on how much you fly and on the terms of your contract. Compensation is denominated in euros (EUR), so a currency conversion applies for Japanese pilots. For specifics, contact Eagle Jet directly.",
    "ops": {
      "routes": "Charter operations across various parts of Europe. Detailed route information is not disclosed.",
      "fleet": "Airbus A320."
    },
    "training": [
      {
        "title": "Type-rating training (as needed)",
        "body": "If you do not already hold the A320 type rating, you may be required to obtain it at your own expense either before or after joining. Details should be confirmed."
      },
      {
        "title": "On-the-job training (OJT)",
        "body": "Building line experience through charter operations."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Route experience",
        "body": "Gain hands-on operational experience on European charter routes."
      },
      {
        "icon": "📄",
        "title": "Contract flexibility",
        "body": "Because work is contract-based, there may be flexibility in working hours."
      }
    ],
    "hiringStatus": "Accepting applications (as of March 2026; deadline 2026.04.04)",
    "hiringColor": "#34d399",
    "jobs": [
      {
        "title": "First Officer (F/O) — Airbus A320",
        "sub": "EASA license holders; low-hour and non-type-rated pilots welcome",
        "status": "Now hiring",
        "statusTag": "green",
        "details": [
          {
            "k": "Requirements",
            "v": "Valid EASA Instrument Rating (IR)"
          },
          {
            "k": "Type Rating",
            "v": "A320 type rating (not required to apply)"
          },
          {
            "k": "Employment Type",
            "v": "Contract (Contract/Freelancer)"
          },
          {
            "k": "Apply To",
            "v": "info@eaglejet.com"
          }
        ],
        "note": ""
      }
    ],
    "recruitUrl": "https://www.latestpilotjobs.com/jobs/view/id/18174.html"
  },
  {
    "file": "fda.html",
    "code": "JH",
    "color": "#FF6600",
    "nameEn": "Fuji Dream Airlines (FDA)",
    "subtitle": "Fuji Dream Airlines — a regional-aviation pioneer connecting Japan's local cities with its colorful fleet.",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🇯🇵 Japan"
      },
      {
        "cls": "tag-orange",
        "label": "FSC"
      },
      {
        "cls": "tag-gray",
        "label": "Regional Aviation"
      },
      {
        "cls": "tag-gray",
        "label": "Colorful Fleet"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "E175 / E175-E2",
        "label": "Operating Fleet"
      },
      {
        "val": "Launched 2009",
        "label": "Founded 2008"
      }
    ],
    "overview": [
      "Fuji Dream Airlines (FDA) is a regional airline based in Shizuoka Prefecture, founded in 2008 and launched into service in 2009. With Shizuoka Airport and Nagoya Komaki Airport as its principal hubs, it operates routes that directly link regional cities across Japan. A defining feature is its <strong>colorful fleet</strong> — each aircraft painted in its own vivid color scheme — giving the airplanes high visibility and an affectionately regarded presence that has made them well loved.",
      "Making use of relatively small regional jets — the Embraer E175 and E175-E2 — FDA has cultivated a niche market linking regional cities that major carriers find hard to serve. It also operates partial codeshares with ANA, connecting into the nationwide network. Through community-rooted management, it supports air-travel demand across the Chubu region, including Shizuoka, Aichi, and Mie."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Shizuoka City, Shizuoka Prefecture"
      },
      {
        "k": "Founded / Launched",
        "v": "Founded 2008 / Launched 2009"
      },
      {
        "k": "Hub",
        "v": "Shizuoka Airport (FSZ) / Nagoya Komaki (NKM)"
      },
      {
        "k": "Codeshare",
        "v": "Partial codeshare with ANA"
      },
      {
        "k": "Airline Type",
        "v": "FSC (Regional aviation)"
      },
      {
        "k": "Retirement Age",
        "v": "65 (Captain)"
      },
      {
        "k": "Fleet",
        "v": "Embraer E175 / E175-E2"
      }
    ],
    "salaryNote": "All salaries are quoted in Japanese yen and are pre-tax (before Japanese income tax and social-insurance deductions). Flight (duty) allowances are paid on top of base pay — a regional-aviation allowance for Captains and a regional-route allowance for First Officers. Performance-linked bonuses are paid two to three times per year, overnight/layover duty allowances are paid separately depending on the route, and loss-of-license insurance (covering both on- and off-duty) is provided.",
    "ops": {
      "routes": "Routes fan out from two bases: from Shizuoka to destinations such as Sapporo, Fukuoka, Kumamoto and Naha, and from Nagoya Komaki to Niigata, Aomori, Akita, Hanamaki and more. Many are direct inter-regional services that major carriers find hard to run profitably, and the ANA codeshare connects them into the nationwide network. Flying regionally builds a distinctive skill set: precise handling of the small Embraer E175 jet, landing technique for a wide variety of regional airports (short runways, mountainous terrain, special approach procedures, and more), sharpened CRM within small crew complements, and a strong sense of mission from directly serving local residents and tourists.",
      "fleet": "Embraer E175 (84-seat regional jet) and E175-E2 (80-seat next-generation type), operated from the Shizuoka and Komaki bases (FSZ / NKM hubs). Every aircraft wears a different colorful livery."
    },
    "training": [
      {
        "title": "Embraer E175 Type Rating",
        "body": "FDA conducts Embraer E175 type-rating training, where crews master the systems, Proline avionics and FMS operation unique to this Brazilian-built regional jet. Transition training to the E175-E2 is also in place."
      },
      {
        "title": "Regional-Airport Operations Training",
        "body": "Operational training at a wide range of regional airports (short runways, mountainous terrain, special approach procedures and more). Pilots learn the characteristics of airports across the country and hone the skill to land safely anywhere."
      },
      {
        "title": "ANA-Aligned Standardization Training",
        "body": "In line with the ANA codeshare, training ensures consistency with ANA operating procedures, delivering ANA brand quality in everyday operations."
      },
      {
        "title": "Captain Upgrade & Recurrent Checks",
        "body": "Because the company is relatively small, upgrade opportunities tend to be comparatively frequent. Recurrent proficiency checks once or twice a year confirm continuous skill improvement."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Flight Ticket Discounts",
        "body": "Discounted FDA tickets for employees and their families. Discounts can also be used on ANA codeshare flights."
      },
      {
        "icon": "🎨",
        "title": "Colorful Workplace Culture",
        "body": "A bright, open workplace culture symbolized by the individually colored aircraft. Its small scale gives it a family-like atmosphere."
      },
      {
        "icon": "🏥",
        "title": "Health Insurance & Medical",
        "body": "Enrollment in the health-insurance society, pilot-specific health-management support, and full loss-of-license insurance."
      },
      {
        "icon": "🏦",
        "title": "Retirement Pay & Pension",
        "body": "A retirement lump-sum scheme and corporate pension are in place, with generous benefit design based on years of service."
      },
      {
        "icon": "👨‍👩‍👧",
        "title": "Childcare & Family-Care Leave",
        "body": "Childcare leave and reduced-hours working systems are in place, with a track record of male pilots taking childcare leave."
      },
      {
        "icon": "📚",
        "title": "Training Cost Support",
        "body": "Type-rating training costs are covered by FDA, as are the costs of transition training to the E175-E2. A continuing-education support program is provided."
      }
    ],
    "hiringStatus": "Experienced-hire recruitment for First Officers and Captains — confirm current openings on the FDA official site (as of March 2026).",
    "hiringColor": "#ff9944",
    "jobs": [
      {
        "title": "Fuji Dream Airlines Pilot Recruitment",
        "sub": "First Officer (F/O) / Captain — experienced-hire",
        "status": "Check official site",
        "statusTag": "gray",
        "details": [
          {
            "k": "Eligibility",
            "v": "Holder of a Commercial Pilot License (multi-engine, instrument) or an Airline Transport Pilot License"
          },
          {
            "k": "Base",
            "v": "Shizuoka Airport or Nagoya Komaki Airport"
          },
          {
            "k": "English",
            "v": "Aviation English Proficiency Level 4 or above"
          }
        ],
        "note": "Hiring availability varies by period — please confirm current openings on the FDA official website."
      },
      {
        "title": "General Application Requirements",
        "sub": "Common eligibility criteria",
        "status": "Requirements",
        "statusTag": "gray",
        "details": [
          {
            "k": "License",
            "v": "Commercial Pilot License (Airplane, Multi-Engine Land) or higher"
          },
          {
            "k": "Instrument Rating",
            "v": "Held"
          },
          {
            "k": "Medical",
            "v": "Class 1 Aviation Medical Certificate"
          },
          {
            "k": "English",
            "v": "Aviation English Proficiency Level 4 or above"
          },
          {
            "k": "Aptitude",
            "v": "Motivation for regional routes and community contribution, plus teamwork"
          }
        ],
        "note": ""
      }
    ],
    "recruitUrl": "https://www.fujidreamairlines.com/company/recruit/"
  },
  {
    "file": "hac.html",
    "code": "HAC",
    "color": "#CC0000",
    "nameEn": "Hokkaido Air System (HAC)",
    "subtitle": "A commuter airline connecting Hokkaido's remote islands and regional communities.",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🇯🇵 Japan"
      },
      {
        "cls": "tag-red",
        "label": "JAL Group"
      },
      {
        "cls": "tag-gray",
        "label": "FSC"
      },
      {
        "cls": "tag-gray",
        "label": "ATR Fleet"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "ATR 42-600",
        "label": "Fleet Type"
      },
      {
        "val": "1997",
        "label": "Founded"
      }
    ],
    "overview": [
      "Hokkaido Air System (HAC) is a commuter airline within the JAL Group, established in 1997. Based at Sapporo's Okadama Airport, it operates regional and remote-island routes across Hokkaido, serving destinations such as Okushiri, Rishiri, Rebun, Hakodate, and Asahikawa. In winter, operations demand flying under harsh weather conditions — heavy snowfall, low visibility, and icy runways — requiring exceptional skill and sound judgment.",
      "Since 2022, HAC has introduced the ATR 42-600 and continues to modernize its fleet. The ATR is a turboprop aircraft built by a French-Spanish joint venture, offering high fuel efficiency and excellent environmental performance. Flying against the backdrop of Hokkaido's magnificent natural landscape brings pilots a special sense of fulfillment."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Chitose, Hokkaido (base: Okadama)"
      },
      {
        "k": "Founded",
        "v": "1997"
      },
      {
        "k": "Hub",
        "v": "Sapporo Okadama Airport (OKD)"
      },
      {
        "k": "Group",
        "v": "JAL Group"
      },
      {
        "k": "Airline Type",
        "v": "FSC (Commuter)"
      },
      {
        "k": "Retirement Age",
        "v": "65 (Captain)"
      }
    ],
    "salaryNote": "Compensation follows JAL Group pay regulations, with bonuses paid twice a year on the JAL Group standard. A cold-region (winter) allowance is paid separately on top of base pay, and loss-of-license insurance covers both on-duty and off-duty incidents. Figures are shown pre-tax in Japanese yen; standard Japanese income tax and social insurance apply.",
    "ops": {
      "routes": "Main routes radiate from the Okadama base in Sapporo: Okadama–Okushiri (about 45 minutes), Okadama–Rishiri (about 50 minutes), and Okadama–Rebun (about 55 minutes), together with regional links such as Hakodate–Okadama and Hakodate–Misawa, forming a network between regional cities across Hokkaido. Operationally, the flying is defined by winter conditions — snow-covered and icy surfaces and low visibility — demanding strong decision-making skills during blizzards and snowfall. HAC leverages the latest ATR 42-600 turboprop technology and operates as vital lifeline infrastructure for the residents of remote islands and regional communities.",
      "fleet": "ATR 42-600 — a 48-seat, latest-generation ATR turboprop. Operations are centered on the Okadama (OKD) hub, specialized for cold-region flying on routes within Hokkaido, and serve remote-island and regional communities as an essential lifeline for the region's residents."
    },
    "training": [
      {
        "title": "JAL Group Training Standards",
        "body": "Aligned with the JAL Group's unified training system. Ground academics, simulator, and actual-aircraft training are all conducted to JAL standards, maintaining safety criteria equivalent to JAL's mainline operation."
      },
      {
        "title": "ATR 42-600 Type Rating",
        "body": "Type-rating training on the French-built ATR turboprop, including sessions at ATR-certified simulator facilities. Pilots master the latest glass-cockpit and FMS operating techniques."
      },
      {
        "title": "Cold-Region & Winter Special Training",
        "body": "Training to handle Hokkaido's distinctive winter weather — blizzards, icing, and low visibility. Pilots acquire cold-region-specific skills such as de-icing procedures and aircraft management in low-temperature environments."
      },
      {
        "title": "Captain Upgrade & Recurrent Checks",
        "body": "After building sufficient flight experience as an F/O, pilots undergo the captain-upgrade assessment. Proficiency checks are mandated once or twice a year, continuously maintaining high safety standards."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "JAL Group Flight Discounts",
        "body": "Discounted JAL Group tickets for employees and their families. Discounts are also available across Oneworld member airlines."
      },
      {
        "icon": "🏥",
        "title": "Health Insurance & Medical Care",
        "body": "Membership in the JAL Group Health Insurance Society, with specialized medical support for pilots and full loss-of-license insurance."
      },
      {
        "icon": "❄️",
        "title": "Hokkaido Posting Support",
        "body": "Cold-region allowance and housing support. A posting where you can fully enjoy Hokkaido's rich natural environment and outdoor lifestyle, including skiing."
      },
      {
        "icon": "🏦",
        "title": "Retirement Allowance & Pension",
        "body": "Retirement allowance and corporate pension based on JAL Group standards, with a substantial program structured according to years of service."
      },
      {
        "icon": "👨‍👩‍👧",
        "title": "Childcare & Family-Care Leave",
        "body": "Comprehensive childcare leave and reduced-hours programs. Male pilots are encouraged to take childcare leave, and family-care leave is also in place."
      },
      {
        "icon": "📚",
        "title": "Training Cost Support",
        "body": "Type-rating training costs are covered by HAC, which also fully funds transition-training costs for the new ATR fleet."
      }
    ],
    "hiringStatus": "Check official site — JAL Group hiring",
    "hiringColor": "#8899aa",
    "jobs": [
      {
        "title": "Hokkaido Air System Pilot Recruitment",
        "sub": "First Officer (F/O) — experienced hire / internal JAL Group transfer",
        "status": "Check official site",
        "statusTag": "gray",
        "details": [
          {
            "k": "Eligibility",
            "v": "Holder of a Commercial Pilot License (multi-engine, instrument), or an internal JAL Group transfer"
          },
          {
            "k": "Base",
            "v": "Sapporo Okadama Airport (Hokkaido)"
          },
          {
            "k": "English Requirement",
            "v": "Aviation English Proficiency Certificate, Level 4 or higher"
          }
        ],
        "note": "Hiring status varies by period. Please confirm the latest information on the JAL Group recruitment page or the HAC official website."
      },
      {
        "title": "General Application Requirements",
        "sub": "Baseline eligibility for pilot applicants",
        "status": "Reference",
        "statusTag": "gray",
        "details": [
          {
            "k": "License",
            "v": "Commercial Pilot License (airplane, multi-engine land)"
          },
          {
            "k": "Instrument Rating",
            "v": "Instrument flight rating held"
          },
          {
            "k": "Medical",
            "v": "First-class aviation medical certificate"
          },
          {
            "k": "English",
            "v": "English ability (Aviation English Proficiency Certificate Level 4+ recommended)"
          },
          {
            "k": "Suitability",
            "v": "Able to adapt to working in a cold-region environment"
          }
        ],
        "note": ""
      }
    ],
    "recruitUrl": "https://www.jal.com/ja/recruit/"
  },
  {
    "file": "ibex.html",
    "code": "FW",
    "color": "#0033A0",
    "nameEn": "IBEX Airlines",
    "subtitle": "A regional carrier connecting regional cities on flights to and from Osaka Itami.",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🇯🇵 Japan"
      },
      {
        "cls": "tag-ibex",
        "label": "FSC"
      },
      {
        "cls": "tag-gray",
        "label": "ANA partnership"
      },
      {
        "cls": "tag-gray",
        "label": "CRJ-700"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "CRJ-700ER",
        "label": "Aircraft operated"
      },
      {
        "val": "Founded 1999",
        "label": "Osaka Itami base"
      }
    ],
    "overview": [
      "IBEX Airlines is a regional airline founded in <strong>1999</strong> and based at Osaka Itami Airport. It maintains a partnership and codeshare with ANA and operates regional routes to and from Itami (Sendai, Yamagata, Niigata, Nagasaki, Kumamoto and others). Its fleet is the <strong>Bombardier CRJ-700ER</strong>, a 70-seat-class regional jet.",
      "The name IBEX comes from the wild goat (ibex) that inhabits the Alps, embodying the agility and strength to bound effortlessly across rugged mountains. As a specialist in regional-jet operations, the airline efficiently sustains its network of regional routes to and from Itami Airport. The CRJ-700 is a type in strong demand worldwide."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Osaka City, Osaka Prefecture"
      },
      {
        "k": "Founded",
        "v": "1999"
      },
      {
        "k": "Hub",
        "v": "Osaka Itami Airport (ITM)"
      },
      {
        "k": "Alliance",
        "v": "ANA partnership & codeshare"
      },
      {
        "k": "Airline Type",
        "v": "FSC (regional)"
      },
      {
        "k": "Retirement Age",
        "v": "65 (Captain)"
      }
    ],
    "salaryNote": "Compensation follows ANA-partnership pay standards. Bonuses are paid two to three times a year on a performance-linked basis. An overnight-operations allowance is paid separately as a supplement for layovers in regional cities, and loss-of-license insurance (covering both on-duty and off-duty) is provided. All figures are stated in Japanese yen; convert to your local currency using the site's currency toggle.",
    "ops": {
      "routes": "Key routes operate to and from Osaka Itami: Itami ⇄ Sendai / Yamagata, Itami ⇄ Niigata, and Itami ⇄ Nagasaki / Kumamoto, with nationwide connectivity provided through ANA codeshare. Flying demands precise operations within Itami Airport's slot-restricted time windows. Regional operations are characterized by the precise regional-jet handling of the CRJ-700, deep familiarity with Itami's congestion and environmental standards, efficient two-pilot (CRM) teamwork, and honed landing technique across a variety of regional airports.",
      "fleet": "Bombardier CRJ-700ER — a 70-seat regional jet. Based at Osaka Itami (ITM) as its hub, the airline is specialized in regional routes on a Kansai-centered network, operating ANA codeshare services."
    },
    "training": [
      {
        "title": "CRJ-700ER Type Rating",
        "body": "Type-rating training on the Bombardier CRJ-700ER. Pilots master the systems unique to this Canadian-built regional jet, the Collins Pro Line 4 avionics, and FMS operation. The type has an extensive worldwide operating record."
      },
      {
        "title": "Itami Airport Special Training",
        "body": "Precision training for Osaka Itami Airport, which is characterized by noise restrictions, curfews, and dense schedules. It thoroughly covers air-traffic-control handling in congested airspace and punctuality-focused operational management."
      },
      {
        "title": "ANA Coordination & Standardization Training",
        "body": "In line with the partnership and codeshare with ANA, training ensures consistency with ANA's standard operating procedures. The program applies ANA quality standards to day-to-day operations."
      },
      {
        "title": "Captain Upgrade & Recurrent Checks",
        "body": "As a regional carrier, the F/O-to-Captain upgrade tends to be relatively smooth. Ongoing skill verification is carried out through proficiency checks one to two times a year."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Flight ticket discounts",
        "body": "IBEX discounted air tickets for employees and their families. Discounts can also be used on ANA codeshare flights."
      },
      {
        "icon": "🏙️",
        "title": "Osaka / Kansai base",
        "body": "Based at Osaka Itami Airport, enjoy life in the Kansai region — working in an area rich in food, culture, and entertainment."
      },
      {
        "icon": "🏥",
        "title": "Health insurance & medical care",
        "body": "Membership in the health insurance society, with health-management support specialized for pilots. Loss-of-license insurance is included."
      },
      {
        "icon": "🏦",
        "title": "Retirement allowance & pension",
        "body": "A retirement allowance scheme and corporate pension are provided, with a generous benefit design based on length of service."
      },
      {
        "icon": "👨‍👩‍👧",
        "title": "Childcare & family-care leave",
        "body": "Childcare leave and reduced-hours work systems are in place, with a track record of male pilots taking childcare leave. Family-care leave is also established."
      },
      {
        "icon": "📚",
        "title": "Training cost support",
        "body": "Type-rating training costs are covered by IBEX, along with a cost-support system for continuing education and skill development."
      }
    ],
    "hiringStatus": "Experienced-hire recruitment (F/O & Captain) — check official site for current status (as of March 2026)",
    "jobs": [
      {
        "title": "IBEX Airlines Pilot Recruitment",
        "sub": "First Officer (F/O) / Captain — experienced hire",
        "status": "Check official site",
        "statusTag": "gray",
        "details": [
          {
            "k": "Eligibility",
            "v": "Holder of a Commercial Pilot License (multi-engine, instrument) or an Airline Transport Pilot License"
          },
          {
            "k": "Location",
            "v": "Osaka Itami Airport (Osaka Prefecture)"
          },
          {
            "k": "English requirement",
            "v": "Aviation English Proficiency certificate, Level 4 or above"
          }
        ],
        "note": "Hiring status varies by period. Please check the IBEX official website for the latest information."
      },
      {
        "title": "Application Requirements (general)",
        "sub": "",
        "status": "General",
        "statusTag": "gray",
        "details": [
          {
            "k": "License",
            "v": "Commercial Pilot License (airplane, multi-engine land) or higher"
          },
          {
            "k": "Instrument rating",
            "v": "Instrument flight rating held"
          },
          {
            "k": "Medical",
            "v": "Class 1 aviation medical certificate"
          },
          {
            "k": "English",
            "v": "Aviation English Proficiency certificate, Level 4 or above"
          },
          {
            "k": "Motivation",
            "v": "Passion for regional routes and contributing to local communities"
          }
        ],
        "note": ""
      }
    ],
    "recruitUrl": "https://www.ibexair.co.jp/company/recruit/"
  },
  {
    "file": "j-air.html",
    "code": "JL",
    "color": "#CC0000",
    "nameEn": "J-Air (J-AIR)",
    "subtitle": "A regional airline of the JAL Group, flying domestic local routes to and from Osaka Itami and Kansai with the CRJ-200.",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🇯🇵 Japan"
      },
      {
        "cls": "tag-red",
        "label": "JAL Group"
      },
      {
        "cls": "tag-gray",
        "label": "FSC"
      },
      {
        "cls": "tag-gray",
        "label": "Regional Airline"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "CRJ-200",
        "label": "Primary Fleet"
      },
      {
        "val": "1991",
        "label": "Founded"
      }
    ],
    "overview": [
      "J-Air (a company distinct from the former Japan Air Commuter, and not its successor) is a regional airline of the JAL Group founded in 1991. Based at Osaka Itami Airport, it operates regional routes across the Shikoku, San'in, Hokuriku, and Chubu regions.",
      "Its hallmark is an efficient regional network operated with the Bombardier CRJ-200 (50 seats). As a member of the JAL Group, its safety management and training framework conform to the standards of JAL's mainline operation. With an extensive record of serving regional airports, pilots can accumulate the diverse route experience characteristic of small aircraft."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Itami, Osaka Prefecture"
      },
      {
        "k": "Founded",
        "v": "1991"
      },
      {
        "k": "Group",
        "v": "JAL Group"
      },
      {
        "k": "Hub",
        "v": "Osaka Itami (ITM)"
      },
      {
        "k": "Fleet",
        "v": "CRJ-200ER"
      },
      {
        "k": "Retirement Age",
        "v": "65"
      }
    ],
    "salaryNote": "As a regional subsidiary of the JAL Group, pay levels are lower than at JAL's mainline operation. That said, a career path involving secondment or transfer to JAL itself also exists. Salaries are paid in Japanese yen (JPY).",
    "ops": {
      "routes": "Domestic regional routes based at Osaka Itami: across Shikoku (Kochi, Matsuyama, Tokushima, Takamatsu); the San'in and San'yo areas (Izumo, Yonago, Tottori, Okayama); and Hokuriku and Noto (Toyama, Komatsu, Noto).",
      "fleet": "CRJ-200ER — 50 seats, the mainstay of regional routes. A 50-seat-class type configured for service to regional airports."
    },
    "training": [
      {
        "title": "CRJ-200 Type Rating",
        "body": "Type-rating training on the Bombardier CRJ-200. Drawing on the JAL Group's training infrastructure, it covers ground-school academics, simulator sessions, and live-aircraft IOE (Initial Operating Experience)."
      },
      {
        "title": "JAL Group Safety Standards",
        "body": "Conforms to the safety management system of JAL's mainline operation. The JAL Group's common quality-control and training programs are applied."
      },
      {
        "title": "Upgrade to Captain",
        "body": "After building experience as a First Officer, pilots upgrade to CRJ-200 Captain. As the company is small, upgrade positions are limited."
      },
      {
        "title": "Secondment / Transfer to JAL",
        "body": "As a JAL Group subsidiary, there are also opportunities for personnel exchange and secondment with JAL's mainline operation, offering a path toward stepping up to larger aircraft."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "JAL Group Travel Privileges",
        "body": "Discounted staff-travel ticket program across the JAL Group companies."
      },
      {
        "icon": "🏥",
        "title": "Medical Insurance",
        "body": "Enrollment in the health insurance society; support for aviation medical examinations."
      },
      {
        "icon": "🏠",
        "title": "Housing Allowance",
        "body": "Housing-support scheme tied to base assignment."
      },
      {
        "icon": "🏦",
        "title": "Retirement Benefits",
        "body": "Defined-contribution pension plan and lump-sum retirement allowance."
      },
      {
        "icon": "📋",
        "title": "Loss-of-License Insurance",
        "body": "Coverage for the risk of losing your license in the course of duty."
      },
      {
        "icon": "🌐",
        "title": "Career Path",
        "body": "Career development is available within the JAL Group."
      }
    ],
    "hiringStatus": "Check official page",
    "hiringColor": "#8899aa",
    "jobs": [
      {
        "title": "Captain / First Officer (CRJ-200)",
        "sub": "Domestic regional routes. Itami-based assignment.",
        "status": "Check official page",
        "statusTag": "gray",
        "details": [
          {
            "k": "Required License",
            "v": "CRJ type rating, or ATPL/CPL plus instrument rating"
          },
          {
            "k": "Language",
            "v": "Japanese required; English at ICAO Level 4 or above"
          },
          {
            "k": "Application",
            "v": "Via the JAL Group careers page"
          }
        ],
        "note": "Please confirm hiring details on the JAL Group careers page and the official J-Air website."
      }
    ],
    "recruitUrl": "https://www.jal.com/ja/recruit/"
  },
  {
    "file": "jac.html",
    "code": "JAC",
    "color": "#CC0000",
    "nameEn": "Japan Air Commuter (JAC)",
    "subtitle": "A Kagoshima-based regional carrier in the JAL Group, connecting Amami and the Nansei (Southwest) Islands with ATR aircraft.",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🇯🇵 Japan"
      },
      {
        "cls": "tag-red",
        "label": "JAL Group"
      },
      {
        "cls": "tag-gray",
        "label": "FSC"
      },
      {
        "cls": "tag-gray",
        "label": "Turboprop"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "ATR 42/72",
        "label": "Main Fleet"
      },
      {
        "val": "1983",
        "label": "Founded"
      }
    ],
    "overview": [
      "Japan Air Commuter (JAC) is a regional airline within the JAL Group, established in 1983. Based at Kagoshima Airport, it operates primarily commuter routes that link the various remote islands of the Amami Islands and the Nansei (Southwest) Islands.",
      "It operates ATR 42-600 and ATR 72-600 turboprop aircraft. Able to handle short runways, it is one of the few airlines that can access the small-scale airports of these remote islands, offering the diverse operating environment distinctive to propeller-driven aircraft."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Kagoshima City"
      },
      {
        "k": "Founded",
        "v": "1983"
      },
      {
        "k": "Group",
        "v": "JAL Group"
      },
      {
        "k": "Hub",
        "v": "Kagoshima Airport (KOJ)"
      },
      {
        "k": "Fleet",
        "v": "ATR 42-600 / ATR 72-600"
      },
      {
        "k": "Retirement Age",
        "v": "65"
      }
    ],
    "salaryNote": "Figures for this carrier are estimates and are shown pre-tax; Japanese income tax applies. Compensation includes flight (duty) allowances and a remote-island duty allowance for Amami and Nansei Islands routes. Amounts are in Japanese yen (¥) and can be converted to other currencies.",
    "ops": {
      "routes": "JAC's network centers on remote-island commuter services: Kagoshima ↔ Amami Ōshima, Kikaijima, Tokunoshima and other islands, plus commuter routes across the Nansei (Southwest) Islands and its remote islands. The airline has an extensive record of serving short-runway, small-scale airports, and extends its reach into a wide-area network through codeshare flights with JAL.",
      "fleet": "ATR 42-600 (50 seats, configured for remote-island service) and ATR 72-600 (70 seats, for trunk routes)."
    },
    "training": [
      {
        "title": "ATR Type-Rating Training",
        "body": "Type-rating training on the ATR 42/72 turboprop aircraft — a specialized program tailored to the characteristics of propeller-driven aircraft."
      },
      {
        "title": "Remote-Island Operations Training",
        "body": "Landing training for short runways and small-scale airports, building the advanced judgment required for remote-island operations where weather can change dramatically."
      },
      {
        "title": "Captain Upgrade",
        "body": "Upgrade to captain after gaining experience as an ATR first officer; the diverse experience of flying remote-island routes is highly valued."
      },
      {
        "title": "JAL Group Training",
        "body": "Participation in the JAL Group's common safety training and resource-management (CRM) training."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "JAL Group Travel Benefits",
        "body": "Discounted staff-travel ticket program across the JAL Group companies."
      },
      {
        "icon": "🏝️",
        "title": "Remote-Island Duty Allowance",
        "body": "Various allowances when assigned to Amami and Nansei Islands routes."
      },
      {
        "icon": "🏥",
        "title": "Medical Insurance",
        "body": "Enrollment in the health insurance association, with support for aviation medical examinations."
      },
      {
        "icon": "🏦",
        "title": "Retirement Benefit Plan",
        "body": "Defined-contribution pension plus a lump-sum retirement allowance."
      },
      {
        "icon": "📋",
        "title": "Loss-of-License Insurance",
        "body": "Coverage for the risk of losing your license in the course of duty."
      },
      {
        "icon": "🌿",
        "title": "Kagoshima-Based Posting",
        "body": "A posting based in Kagoshima, amid the nature-rich environment of southern Kyushu and the Nansei Islands."
      }
    ],
    "hiringStatus": "Refer to JAL Group careers page",
    "hiringColor": "#34d399",
    "jobs": [
      {
        "title": "Captain / First Officer (ATR 42/72)",
        "sub": "Amami and Nansei Islands routes. Kagoshima-based posting.",
        "status": "Check official page",
        "statusTag": "gray",
        "details": [
          {
            "k": "License",
            "v": "ATR type rating, or CPL + instrument rating"
          },
          {
            "k": "Language",
            "v": "Japanese required. English ICAO Level 4 or above."
          },
          {
            "k": "Application",
            "v": "Via the JAL Group careers page"
          }
        ],
        "note": "Please confirm hiring information on the JAL Group careers page and the official JAC website."
      }
    ],
    "recruitUrl": "https://www.jal.com/ja/recruit/"
  },
  {
    "file": "jta.html",
    "code": "JTA",
    "color": "#CC0000",
    "nameEn": "Japan Transocean Air (JTA)",
    "subtitle": "A JAL Group airline based in Okinawa, operating primarily on Okinawa routes with the Boeing 737-800.",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🇯🇵 Japan"
      },
      {
        "cls": "tag-red",
        "label": "JAL Group"
      },
      {
        "cls": "tag-gray",
        "label": "FSC"
      },
      {
        "cls": "tag-gold",
        "label": "Oneworld"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "B737-800",
        "label": "Main Fleet"
      },
      {
        "val": "1967",
        "label": "Founded (predecessor)"
      }
    ],
    "overview": [
      "Japan Transocean Air (JTA) is a JAL Group airline founded in 1967 as Southwest Air Lines (Nansei Airlines). Based at Naha Airport, it operates routes connecting the main island of Okinawa with major cities on the Japanese mainland and Okinawa's outlying islands.",
      "Operating the Boeing 737-800, it is known as a specialist in Okinawa routes. As a member of the JAL Group, it also belongs to the Oneworld alliance, playing a vital role in supporting Okinawa's tourism demand."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Naha, Okinawa Prefecture"
      },
      {
        "k": "Founded",
        "v": "1967 (predecessor: Southwest Air Lines)"
      },
      {
        "k": "Group",
        "v": "JAL Group"
      },
      {
        "k": "Hub",
        "v": "Naha Airport (OKA)"
      },
      {
        "k": "Fleet",
        "v": "B737-800"
      },
      {
        "k": "Retirement Age",
        "v": "65"
      }
    ],
    "salaryNote": "All published figures are pre-tax estimates. Pilot pay is denominated in Japanese yen (JPY) and is subject to Japanese income tax and social insurance; convert to your home currency when comparing with overseas carriers.",
    "ops": {
      "routes": "JTA's network centers on trunk routes linking Naha with Tokyo, Osaka, Nagoya and other mainland cities, together with Okinawa inter-island routes (Ishigaki, Miyako, Kumejima and others). It operates numerous codeshare flights with JAL and is responsible for key routes that support Okinawa's tourism demand.",
      "fleet": "The Boeing 737-800 (166 seats) is the mainstay fleet, configured for domestic trunk operations and specialized in Okinawa routes."
    },
    "training": [
      {
        "title": "B737 Type Rating Training",
        "body": "Type-rating training on the Boeing 737-800, following the JAL Group's training framework with ground school, simulator sessions and aircraft IOE (Initial Operating Experience)."
      },
      {
        "title": "JAL Group Safety Management",
        "body": "Training and quality-management programs aligned with the safety-management system of JAL mainline."
      },
      {
        "title": "Captain Upgrade",
        "body": "Upgrade to B737-800 Captain after gaining First Officer experience, building trunk-route operating experience between Okinawa and the mainland."
      },
      {
        "title": "JAL Secondment & Transfer",
        "body": "Opportunities for personnel exchange and secondment within the JAL Group, including a path to step up to larger aircraft."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "JAL Group Travel Privileges",
        "body": "Discounted staff-fare ticket program across the JAL Group companies."
      },
      {
        "icon": "🌺",
        "title": "Okinawa Posting",
        "body": "Naha base. Life in Okinawa's warm climate and natural surroundings."
      },
      {
        "icon": "🏥",
        "title": "Medical Insurance",
        "body": "Enrollment in the health insurance association, with support for aviation medical examinations."
      },
      {
        "icon": "🏦",
        "title": "Retirement Benefits",
        "body": "Defined-contribution pension plus a lump-sum retirement allowance program."
      },
      {
        "icon": "📋",
        "title": "Loss-of-License Insurance",
        "body": "Coverage for the risk of losing your license in the course of duty."
      },
      {
        "icon": "🌐",
        "title": "Oneworld Benefits",
        "body": "Partner-airline mileage and privileges through Oneworld membership."
      }
    ],
    "hiringStatus": "Refer to JAL Group careers page",
    "jobs": [
      {
        "title": "Captain / First Officer (B737-800)",
        "sub": "Okinawa routes. Naha-based.",
        "status": "Check official page",
        "statusTag": "gray",
        "details": [
          {
            "k": "License",
            "v": "B737 type rating (ATPL/CPL + instrument rating)"
          },
          {
            "k": "Language",
            "v": "Japanese required; English ICAO Level 4 or above"
          },
          {
            "k": "Application",
            "v": "Via JAL Group careers page"
          }
        ],
        "note": "Please confirm hiring details on the JAL Group careers page and the official JTA website."
      }
    ],
    "recruitUrl": "https://www.jal.com/ja/recruit/"
  },
  {
    "file": "orc.html",
    "code": "OC",
    "color": "#1B4F97",
    "nameEn": "Oriental Air Bridge (ORC)",
    "subtitle": "Oriental Air Bridge — a historic regional commuter carrier connecting the remote islands of Nagasaki.",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🇯🇵 Japan"
      },
      {
        "cls": "tag-orc",
        "label": "FSC"
      },
      {
        "cls": "tag-gray",
        "label": "ANA Partnership"
      },
      {
        "cls": "tag-gray",
        "label": "Remote-Island Routes"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "DHC-8-Q400",
        "label": "Aircraft Operated"
      },
      {
        "val": "1961",
        "label": "Founded (ex-Nagasaki Airways)"
      }
    ],
    "overview": [
      "Oriental Air Bridge (ORC) was founded in 1961 as \"Nagasaki Airways\" and is a <strong>historic regional carrier</strong> that has served the remote-island routes of Nagasaki Prefecture for many years. Based at Nagasaki Airport, it operates routes to Goto Fukue, Iki, Tsushima, Fukuoka and other destinations. Through its partnership and codeshare with ANA, it secures connectivity to a nationwide network.",
      "Nagasaki Prefecture has many remote islands, with numerous inhabited islands such as the Goto Islands, Iki and Tsushima. Connecting in 30 to 40 minutes islands that would otherwise take several hours by ferry, ORC's routes are an <strong>indispensable part of the islanders' living infrastructure</strong>. Operating the DHC-8-Q400, the airline has earned the trust of local residents through high punctuality and safety."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Nagasaki City, Nagasaki Prefecture"
      },
      {
        "k": "Founded",
        "v": "1961 (formerly Nagasaki Airways)"
      },
      {
        "k": "Hub",
        "v": "Nagasaki Airport (NGS)"
      },
      {
        "k": "Alliance",
        "v": "ANA partnership & codeshare"
      },
      {
        "k": "Airline Type",
        "v": "FSC (commuter)"
      },
      {
        "k": "Retirement Age",
        "v": "65 (Captain)"
      }
    ],
    "salaryNote": "All figures are in Japanese yen and are subject to Japanese income tax. Bonuses are paid twice a year, based on ANA-partnership standards. Remote-island allowances are paid separately and set on a per-route basis, and both flight (duty) allowances and remote-island allowances add to base pay. Loss-of-license insurance covering both on-duty and off-duty situations is provided.",
    "ops": {
      "routes": "ORC's core network centers on Nagasaki's remote islands: Nagasaki–Goto Fukue (approx. 30 min), Nagasaki–Iki (approx. 25 min), Nagasaki–Tsushima (approx. 35 min), and Nagasaki–Fukuoka (approx. 40 min), plus an inter-island network within Nagasaki Prefecture. Operations are defined by short-haul, high-frequency island flying; expertise in over-water flight and island-specific weather; precise landing technique on the DHC-8-Q400; and more than 60 years of remote-island operating history and trust.",
      "fleet": "DHC-8-Q400 — a 74-seat large Dash 8 turboprop — based at Nagasaki Airport (NGS) as its hub. Operations are focused on remote islands within Nagasaki Prefecture, including ANA codeshare flights."
    },
    "training": [
      {
        "title": "DHC-8-Q400 Type Rating",
        "body": "Type-rating training on the DHC-8-Q400 (Dash 8 Q400). Pilots master its systems as a 74-seat large turboprop, along with the Q400's distinctive high-wing configuration and noise-reduction system."
      },
      {
        "title": "Remote-Island & Over-Water Flight Training",
        "body": "Training in Nagasaki's island-specific weather, over-water flight, and precise landings on short runways. Pilots acquire island-flying specialist skills such as handling sudden fog, shifting wind directions, and maritime air currents."
      },
      {
        "title": "ANA Coordination & Standardization Training",
        "body": "In line with the ANA partnership and codeshare, operations are kept consistent with ANA's standard operating procedures, and day-to-day duties are carried out under ANA quality standards."
      },
      {
        "title": "Captain Upgrade & Recurrent Checks",
        "body": "The high number of landings at a remote-island carrier sharpens pilots' skills. Continuous safety standards are maintained through proficiency checks conducted once or twice a year."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Flight Ticket Discounts",
        "body": "Discounted ORC tickets for pilots and their families. Discounts on ANA codeshare flights can also be used."
      },
      {
        "icon": "🌊",
        "title": "Nagasaki Living Support",
        "body": "Nagasaki offers beautiful scenery, a rich food culture, and a mild climate, with attractive access to the Goto Islands, Iki, and Tsushima."
      },
      {
        "icon": "🏥",
        "title": "Health Insurance & Medical Care",
        "body": "Enrollment in the health insurance society, with pilot-specialized health management support and full loss-of-license insurance coverage."
      },
      {
        "icon": "🏦",
        "title": "Retirement Pay & Pension",
        "body": "A retirement allowance scheme and corporate pension are fully provided, backed by a stable corporate foundation with over 60 years of history."
      },
      {
        "icon": "👨‍👩‍👧",
        "title": "Childcare & Family-Care Leave",
        "body": "Childcare leave and reduced-hours work systems are fully available, letting families enjoy Nagasaki's rich natural environment together."
      },
      {
        "icon": "📚",
        "title": "Training Cost Support",
        "body": "Type-rating costs are borne by ORC, with a cost-support program available for continuing education and skill development."
      }
    ],
    "hiringStatus": "Experienced-pilot hiring (F/O & Captain) — confirm on official site",
    "jobs": [
      {
        "title": "Oriental Air Bridge Pilot Recruitment",
        "sub": "First Officer (F/O) / Captain — experienced hire",
        "status": "Check official site",
        "statusTag": "gray",
        "details": [
          {
            "k": "Eligibility",
            "v": "Commercial Pilot License (multi-engine, instrument) or Airline Transport Pilot License holder"
          },
          {
            "k": "Base",
            "v": "Nagasaki Airport (Nagasaki Prefecture)"
          },
          {
            "k": "English",
            "v": "Aviation English Proficiency Certificate Level 4 or above"
          }
        ],
        "note": "Hiring availability varies by period; please confirm on ORC's official website."
      },
      {
        "title": "General Application Requirements",
        "sub": "Baseline eligibility for pilot applicants",
        "status": "Requirements",
        "statusTag": "gray",
        "details": [
          {
            "k": "License",
            "v": "Commercial Pilot License (airplane, multi-engine land) or higher"
          },
          {
            "k": "Instrument Rating",
            "v": "Instrument flight rating held"
          },
          {
            "k": "Medical",
            "v": "Class 1 aviation medical certificate"
          },
          {
            "k": "English",
            "v": "Aviation English Proficiency Certificate Level 4 or above"
          },
          {
            "k": "Motivation",
            "v": "Passion for remote-island routes and regional contribution, and willingness to work in Nagasaki"
          }
        ],
        "note": ""
      }
    ],
    "recruitUrl": "https://www.orc.co.jp/company/recruit/"
  },
  {
    "file": "rac.html",
    "code": "RAC",
    "color": "#CC0000",
    "nameEn": "Ryukyu Air Commuter (RAC)",
    "subtitle": "Ryukyu Air Commuter — a commuter airline connecting Okinawa's remote islands.",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🇯🇵 Japan"
      },
      {
        "cls": "tag-red",
        "label": "JAL Group"
      },
      {
        "cls": "tag-gray",
        "label": "FSC"
      },
      {
        "cls": "tag-gray",
        "label": "DHC-8"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "DHC-8-Q300",
        "label": "Fleet"
      },
      {
        "val": "1981",
        "label": "Founded"
      }
    ],
    "overview": [
      "Ryukyu Air Commuter (RAC) is a commuter airline within the JAL Group, established in 1981. Based at Naha Airport on Okinawa's main island, it specializes in serving Okinawa's remote-island routes, including Kumejima, Aguni, Tokashiki, Minamidaito and Kitadaito. It plays a vital role as essential daily-life infrastructure for island residents, providing rapid access to remote islands that would otherwise take several hours to reach by ferry.",
      "As a member of the JAL Group, RAC maintains high safety standards that comply with JAL's maintenance and operational criteria, while specializing in low-capacity passenger transport aboard turboprop aircraft (the DHC-8-Q300). Its captains are local experts who combine advanced airmanship with intimate knowledge of the weather and terrain unique to the remote islands. Flying experience in the specialized environment of Okinawa's island routes builds a valuable career for a pilot."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Naha, Okinawa, Japan"
      },
      {
        "k": "Founded",
        "v": "1981"
      },
      {
        "k": "Hub",
        "v": "Naha Airport (OKA)"
      },
      {
        "k": "Group",
        "v": "JAL Group"
      },
      {
        "k": "Airline Type",
        "v": "FSC (Commuter)"
      },
      {
        "k": "Retirement Age",
        "v": "65 (Captain)"
      },
      {
        "k": "Income Tax",
        "v": "Japan (taxable)"
      }
    ],
    "salaryNote": "Compensation follows JAL Group pay regulations, with bonuses paid twice a year to JAL Group standards. A remote-island allowance is paid separately and set per route, and First Officers receive an added island allowance on top of base pay. Comprehensive loss-of-license insurance covering both on- and off-duty is provided. As Japan-based employment, pay is denominated in Japanese yen and subject to Japanese income tax.",
    "ops": {
      "routes": "RAC's network centers on short hops from Naha out to Okinawa's remote islands: Naha ↔ Kumejima (approx. 35 min), Naha ↔ Aguni (approx. 25 min), Naha ↔ Tokashiki (approx. 20 min), and Naha ↔ Minamidaito / Kitadaito (approx. 1 hour), together with inter-island connecting routes across Okinawa. Operations are short-haul and high-frequency, with multiple flights per day. Pilots need the ability to cope with the rapidly changing weather typical of island environments, precision-approach skills for small airports, and a strong sense of mission serving as a lifeline for island residents.",
      "fleet": "DHC-8-Q300 — a 50-seat turboprop. Naha (OKA) serves as the hub, and the operation is dedicated to remote-island routes within Okinawa Prefecture, functioning as an essential daily-life lifeline for island communities."
    },
    "training": [
      {
        "title": "JAL Group Training Standards",
        "body": "Conducted in line with the JAL Group's unified training system. Ground school, simulator training and actual-aircraft training are all carried out to JAL standards. Safety levels are equivalent to those of JAL itself."
      },
      {
        "title": "DHC-8 Type Rating",
        "body": "Pilots obtain the type rating for the Bombardier DHC-8-Q300. Mastery of turboprop-specific characteristics such as torque and P-factor is required. Simulator training is conducted at shared JAL Group facilities."
      },
      {
        "title": "Special Island-Route Training",
        "body": "Route training specialized for the weather, terrain and airport facilities of Okinawa's remote islands. Emphasis is placed on landings on short runways, over-water flying and handling sudden weather changes."
      },
      {
        "title": "Captain Upgrade & Recurrent Checks",
        "body": "After accumulating flight experience as a First Officer, pilots undergo the captain upgrade assessment. Recurrent proficiency checks are held once or twice a year, maintaining the JAL Group's rigorous safety standards."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "JAL Group Flight Discounts",
        "body": "Discounted JAL Group tickets for pilots and their families. Discounts at oneworld member airlines can also be used."
      },
      {
        "icon": "🏥",
        "title": "Health Insurance & Medical",
        "body": "Membership in the JAL Group Health Insurance Society, with a dedicated health-screening and medical-support system for pilots. Comprehensive loss-of-license insurance is included."
      },
      {
        "icon": "🌺",
        "title": "Okinawa Posting Allowance",
        "body": "A regional allowance and housing support for working at the Naha base. The rich natural environment of Okinawa offers an attractive lifestyle."
      },
      {
        "icon": "🏦",
        "title": "Retirement Benefits & Pension",
        "body": "A retirement lump-sum and corporate pension based on JAL Group standards, with benefits designed according to years of service."
      },
      {
        "icon": "👨‍👩‍👧",
        "title": "Childcare & Family-Care Leave",
        "body": "Full childcare leave and reduced-hours arrangements. RAC promotes childcare leave for male pilots, with a track record of family-care leave as well."
      },
      {
        "icon": "📚",
        "title": "Training Cost Support",
        "body": "Type-rating training costs are covered by RAC, and a support system for continuing education and skill development is in place."
      }
    ],
    "hiringStatus": "Hiring varies by period — check official site (JAL Group)",
    "jobs": [
      {
        "title": "Ryukyu Air Commuter Pilot Recruitment",
        "sub": "First Officer (F/O) — experienced hires / internal JAL Group transfers",
        "status": "Check official site",
        "statusTag": "gray",
        "details": [
          {
            "k": "Eligibility",
            "v": "Holders of a Commercial Pilot License (multi-engine, instrument), or internal JAL Group transfer"
          },
          {
            "k": "Work Location",
            "v": "Naha Airport (Okinawa)"
          },
          {
            "k": "English Requirement",
            "v": "Aviation English Proficiency Level 4 or above"
          }
        ],
        "note": "Hiring status varies by period. Please check the JAL Group recruitment page or the official RAC website. As a career path within the JAL Group, the internal transfer system is also widely used."
      },
      {
        "title": "General Application Requirements",
        "sub": "Baseline eligibility criteria for pilot applicants",
        "status": "Common criteria",
        "statusTag": "gray",
        "details": [
          {
            "k": "License",
            "v": "Commercial Pilot License (Airplane, Multi-Engine Land)"
          },
          {
            "k": "Instrument",
            "v": "Instrument Rating held"
          },
          {
            "k": "Medical",
            "v": "Class 1 Aviation Medical Certificate"
          },
          {
            "k": "English",
            "v": "Aviation English Proficiency Level 4 or above (recommended)"
          },
          {
            "k": "Condition",
            "v": "Sound physical and mental health"
          }
        ],
        "note": ""
      }
    ],
    "recruitUrl": "https://www.jal.com/ja/recruit/"
  },
  {
    "file": "root-aviation.html",
    "code": "RT",
    "color": "#34d399",
    "nameEn": "Root Aviation",
    "subtitle": "A specialist pilot placement agency dedicated to airlines across the Asia region.",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🌏 Asia"
      },
      {
        "cls": "tag-green",
        "label": "Agency"
      },
      {
        "cls": "tag-blue",
        "label": "B777 Position"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "Asia",
        "label": "Region"
      },
      {
        "val": "B777",
        "label": "Fleet"
      }
    ],
    "overview": [
      "Root Aviation is a specialist agency that supports pilot recruitment for airlines across the Asia region. Rather than employing pilots directly, it performs position matching through an agency model. The current opening is a <strong>Boeing 777 Captain (PIC) upgrade</strong> position, placing pilots with B747 experience into a specific airline in the Asia region. Detailed information on destinations and employment conditions must be obtained by contacting Root Aviation directly."
    ],
    "facts": [
      {
        "k": "Business Type",
        "v": "Pilot placement agency"
      },
      {
        "k": "Region",
        "v": "Asia"
      },
      {
        "k": "Employment",
        "v": "Direct hire by the client airline (via agency)"
      },
      {
        "k": "Target Aircraft",
        "v": "Boeing 777"
      },
      {
        "k": "Annual salary",
        "v": "Contact for details (depends on client airline)"
      },
      {
        "k": "Posting Date",
        "v": "Posted March 23, 2026"
      }
    ],
    "salaryNote": "This is an agency-brokered position, so the annual salary is set by the terms of the individual client airline. No pay figures are published for this opening — candidates must contact Root Aviation directly for details.",
    "ops": {
      "routes": "Asia region (varies by client airline).",
      "fleet": "Boeing 777 (the upgrade type). Priority given to candidates with B747 experience."
    },
    "training": [
      {
        "title": "B777 Type Rating Training",
        "body": "Upgrade training from the B747 to the B777, conducted at the client airline's training center."
      },
      {
        "title": "Line Training",
        "body": "Line flying training following the type rating, carried out according to the employing airline's regulations."
      }
    ],
    "benefits": [
      {
        "icon": "🌏",
        "title": "Working in Asia",
        "body": "Flying opportunities across the Asia region. The package varies depending on the airline's circumstances."
      },
      {
        "icon": "📞",
        "title": "Agency Support",
        "body": "Job-search support and negotiation handled on your behalf by Root Aviation."
      }
    ],
    "hiringStatus": "Position available (as of March 2026; application deadline April 10, 2026)",
    "hiringColor": "#34d399",
    "jobs": [
      {
        "title": "B777 PIC Upgrade Position",
        "sub": "For pilots with B747 experience",
        "status": "Now Hiring",
        "statusTag": "green",
        "details": [
          {
            "k": "Eligibility",
            "v": "Captains with B747-400 / B747-800 experience"
          },
          {
            "k": "Position",
            "v": "Upgrade to B777 Captain (PIC)"
          },
          {
            "k": "Region",
            "v": "Asia (details undisclosed)"
          }
        ],
        "note": "For details, apply via Latest Pilot Jobs or contact Root Aviation directly."
      }
    ],
    "recruitUrl": "https://www.latestpilotjobs.com/jobs/view/id/19683.html"
  },
  {
    "file": "shin-central.html",
    "code": "新中央",
    "color": "#003087",
    "nameEn": "Shin Chuo Airlines (Shin Nichi Aviation)",
    "subtitle": "Tokyo's own wings, linking the Izu Islands with flights out of Chofu Airfield.",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🇯🇵 Japan"
      },
      {
        "cls": "tag-navy2",
        "label": "Commuter"
      },
      {
        "cls": "tag-gray",
        "label": "Izu Islands"
      },
      {
        "cls": "tag-gray",
        "label": "Light aircraft"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "C208B / DHC-6",
        "label": "Fleet in service"
      },
      {
        "val": "Est. 1953",
        "label": "Chofu Airfield base"
      }
    ],
    "overview": [
      "Shin Chuo Airlines is an independent commuter airline founded in 1953. Based at Chofu Airfield in Chofu City, Tokyo, it operates commuter routes to the islands of the Izu archipelago, including Oshima, Niijima, Kozushima and Miyakejima. Its hallmark is small-capacity transport using light aircraft — the Cessna 208B Grand Caravan and the DHC-6 Twin Otter.",
      "As essential everyday transport for the residents of Tokyo's island districts, it is a <strong>storied airline that has supported the Izu Islands for more than 70 years</strong>. One aspect of its distinctiveness is that it is based not at Haneda or Narita but at Chofu Airfield, an urban light-aircraft airfield. Flying experience on light aircraft contributes to developing a high level of skill as a pilot."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Chofu City, Tokyo"
      },
      {
        "k": "Founded",
        "v": "1953"
      },
      {
        "k": "Hub",
        "v": "Chofu Airfield (CHO)"
      },
      {
        "k": "Group",
        "v": "Independent"
      },
      {
        "k": "Airline type",
        "v": "FSC (light-aircraft commuter)"
      },
      {
        "k": "Destinations",
        "v": "Izu Islands (Oshima, Niijima, etc.)"
      }
    ],
    "salaryNote": "Compensation is paid in Japanese yen (¥) and the figures the site shows are pre-tax, before Japanese income tax and social insurance are deducted. Bonuses are paid twice a year on independent-company terms. A separate Izu-island route allowance is added for island services, and crews receive light-aircraft specialist and Izu Islands duty allowances on top of base pay. Loss-of-license insurance covering both on-duty and off-duty causes is provided.",
    "ops": {
      "routes": "Operating out of Chofu, the airline's core network links Tokyo to the Izu Islands: Chofu–Oshima (about 25 min), Chofu–Niijima (about 35 min), Chofu–Kozushima (about 40 min) and Chofu–Miyakejima (about 50 min), plus connecting services between the islands. The flying is demanding in character: precision handling of 9-to-19-seat light aircraft; over-water flight and landing technique for islands with mountainous terrain; operating within the special airspace and ATC procedures of Chofu Airfield; and immediate response to changing weather, including turn-back (diversion) decisions.",
      "fleet": "Cessna 208B Grand Caravan — 9-seat single-engine turboprop; DHC-6 Twin Otter — 19-seat twin-engine turboprop. The home base is Chofu Airfield (CHO hub), and the Izu Islands services function as a lifeline route for island residents."
    },
    "training": [
      {
        "title": "C208B & DHC-6 type-rating",
        "body": "Type-rating training is conducted on the single-engine Cessna 208B Grand Caravan and the twin-engine DHC-6 Twin Otter. Pilots gain a deep command of the precise, hands-on manual flying and aircraft systems unique to light aircraft."
      },
      {
        "title": "Over-water & island flying training",
        "body": "Training in coping with the complex terrain of the Izu Islands (mountainous, steep terrain) and with maritime weather. Pilots hone precision approaches to small airfields and short takeoff and landing (STOL) technique."
      },
      {
        "title": "Chofu Airfield special training",
        "body": "Flight training within the special airspace of the Tokyo metropolitan area (the Yokota control area and Tokyo airspace). Pilots master Chofu Airfield's distinctive operating rules and ATC communication procedures."
      },
      {
        "title": "Captain upgrade & recurrent checks",
        "body": "Extensive flying experience on light aircraft builds the core airmanship required of a captain. Continuous safety standards are maintained through proficiency checks held once or twice a year."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Flight-ticket discounts",
        "body": "Discounted air tickets for employees and their families, making day trips and overnight stays in the Izu Islands easy to enjoy."
      },
      {
        "icon": "🌊",
        "title": "Izu Islands & Greater Tokyo",
        "body": "A Chofu (Tokyo) base lets you enjoy metropolitan life, with good access to the rich nature and beautiful seas of the Izu Islands."
      },
      {
        "icon": "🏥",
        "title": "Health insurance & medical care",
        "body": "Enrollment in the health insurance society, pilot-specific health-management support, and full loss-of-license insurance."
      },
      {
        "icon": "🏦",
        "title": "Retirement pay & pension",
        "body": "A retirement-allowance scheme is in place — a stable independent company with a history of more than 70 years."
      },
      {
        "icon": "✈️",
        "title": "The strength of a light-aircraft career",
        "body": "Extensive flying experience on light aircraft contributes to building core pilot skills and also forms a foundation for a future transition to larger aircraft."
      },
      {
        "icon": "📚",
        "title": "Training-cost support",
        "body": "Type-rating training costs are covered by Shin Chuo Airlines, with support schemes also available for obtaining and maintaining light-aircraft qualifications."
      }
    ],
    "hiringStatus": "Experienced-hire recruitment — check official site (as of March 2026)",
    "hiringColor": "#8899aa",
    "jobs": [
      {
        "title": "Shin Chuo Airlines pilot recruitment",
        "sub": "First Officer (F/O) / Captain — experienced-hire",
        "status": "Check official site",
        "statusTag": "gray",
        "details": [
          {
            "k": "Eligibility",
            "v": "Holder of a Commercial Pilot Licence (single- or multi-engine, instrument)"
          },
          {
            "k": "Location",
            "v": "Chofu Airfield (Chofu City, Tokyo)"
          },
          {
            "k": "English requirement",
            "v": "Aviation English Proficiency certification, Level 4 or above"
          }
        ],
        "note": "Hiring availability varies by period; please check the Shin Chuo Airlines official site. Preference is given to those with light-aircraft experience and a passion for the Izu Islands routes."
      },
      {
        "title": "General application requirements",
        "sub": "Baseline criteria for applicants",
        "status": "General",
        "statusTag": "gray",
        "details": [
          {
            "k": "License",
            "v": "Commercial Pilot Licence (aeroplane, single- or multi-engine land) or above"
          },
          {
            "k": "Instrument rating",
            "v": "Instrument rating held (preferred)"
          },
          {
            "k": "Medical",
            "v": "First-class aviation medical certificate"
          },
          {
            "k": "English",
            "v": "Aviation English Proficiency certification, Level 4 or above"
          },
          {
            "k": "Aptitude",
            "v": "A sense of mission for remote-island / commuter routes, and teamwork"
          }
        ],
        "note": ""
      }
    ],
    "recruitUrl": "https://www.shinnihon-air.co.jp/recruit/"
  },
  {
    "file": "shin-nihon.html",
    "code": "SNJ",
    "color": "#CC0033",
    "nameEn": "Shin Nihon Airlines",
    "subtitle": "A commuter airline connecting the remote islands of Kagoshima.",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🇯🇵 Japan"
      },
      {
        "cls": "tag-red",
        "label": "Commuter"
      },
      {
        "cls": "tag-gray",
        "label": "Kagoshima Islands"
      },
      {
        "cls": "tag-gray",
        "label": "Small Aircraft"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "C208B / BN-2",
        "label": "Fleet"
      },
      {
        "val": "Est. 2005",
        "label": "Kagoshima Airport base"
      }
    ],
    "overview": [
      "Shin Nihon Airlines is an independent commuter airline established in 2005 and based in Kagoshima Prefecture. Operating out of Kagoshima Airport, it handles commuter routes to the prefecture's remote islands, including Okinoerabu and Yoron. It provides island access with small aircraft such as the Cessna 208B Grand Caravan and the Britten-Norman BN-2 Islander.",
      "Kagoshima Prefecture is home to many inhabited islands, and the airline plays a vital role in supporting islanders' daily lives, medical care, and logistics. Connecting these islands in 30 to 60 minutes — a journey that takes many hours by ferry — is indispensable for residents. As a small airline with a strong social mission, it offers a pilot career deeply rooted in the local community."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Kagoshima City, Kagoshima Prefecture"
      },
      {
        "k": "Founded",
        "v": "2005"
      },
      {
        "k": "Hub",
        "v": "Kagoshima Airport (KOJ)"
      },
      {
        "k": "Group",
        "v": "Independent"
      },
      {
        "k": "Airline Type",
        "v": "FSC (small commuter aircraft)"
      },
      {
        "k": "Destinations",
        "v": "Kagoshima islands (Okinoerabu, Yoron, etc.)"
      }
    ],
    "salaryNote": "All figures are in Japanese yen and subject to Japan's progressive income tax. Compensation includes a bonus paid twice a year (in line with independent-company norms) and separate remote-island / regional allowances that are set on a per-route basis. Both captains and first officers earn island-route and Kagoshima allowances on top of base pay, plus a flight (duty) allowance paid per flight. Loss-of-license insurance is provided for both on-duty and off-duty incidents.",
    "ops": {
      "routes": "Major routes from Kagoshima include Kagoshima ↔ Okinoerabu (approx. 55 minutes) and Kagoshima ↔ Yoron (approx. 60 minutes), along with commuter routes between islands within Kagoshima Prefecture and charter and special-transport operations. Flying the Kagoshima islands has distinctive demands: coping with the Nansei Islands' unusual weather (typhoons and seasonal winds), over-water flight and precision landings at small, confined airfields, building strong manual-handling skill on very small aircraft, and a powerful sense of mission as a lifeline for island residents.",
      "fleet": "Cessna 208B Grand Caravan (9-seat single-engine turboprop) and Britten-Norman BN-2 Islander (9-seat twin-engine piston). Based at Kagoshima Airport (KOJ hub), serving the Nansei Islands within Kagoshima Prefecture."
    },
    "training": [
      {
        "title": "C208B / BN-2 Type-Rating Training",
        "body": "Type-rating training on the Cessna 208B Grand Caravan (single-engine turboprop) and the BN-2 Islander (twin-engine piston). Mastering the different airframe characteristics and propulsion systems builds broad technical skill."
      },
      {
        "title": "Kagoshima Island Flight Training",
        "body": "Training to handle the weather peculiar to the Nansei Islands (typhoons, seasonal winds, and squalls). Pilots learn the airfield characteristics and approach procedures of each island, such as Okinoerabu and Yoron."
      },
      {
        "title": "Small, Elite-Team Training",
        "body": "The direct, high-density instruction from captains that only a small company can offer. Beyond stick-and-rudder flying, pilots gain broad experience in other aviation duties such as weather judgment, maintenance checks, and ground operations."
      },
      {
        "title": "Captain Upgrade & Recurrent Checks",
        "body": "The high number of flights and landings on small aircraft accelerates skill development. Safety standards are maintained through recurrent checks once or twice a year, and the small workforce means opportunities for early upgrade to captain."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Flight Discounts",
        "body": "Discounted air tickets for employees and their families, making trips to Kagoshima's remote islands easy to enjoy."
      },
      {
        "icon": "🌋",
        "title": "Kagoshima Living Support",
        "body": "Based in Kagoshima City, enjoy the great outdoors of Sakurajima and Kirishima. The rich food culture — hot springs, Kagoshima black pork, and shochu — is another draw."
      },
      {
        "icon": "🏥",
        "title": "Health Insurance & Medical Care",
        "body": "Enrollment in the health insurance association, dedicated pilot health-management support, and full loss-of-license insurance."
      },
      {
        "icon": "🏦",
        "title": "Retirement Allowance & Pension",
        "body": "A retirement-allowance program is in place. As a stable independent company, it supports long-term careers."
      },
      {
        "icon": "🎓",
        "title": "Building Broad Flying Skills",
        "body": "Diverse flying experience across single- and twin-engine, turboprop and piston aircraft — an environment to sharpen your core skills as a pilot."
      },
      {
        "icon": "📚",
        "title": "Training Cost Support",
        "body": "Type-rating training costs are covered by Shin Nihon Airlines, with support programs for obtaining and maintaining multiple-type ratings."
      }
    ],
    "hiringStatus": "Hiring status varies — check official site",
    "jobs": [
      {
        "title": "Shin Nihon Airlines Pilot Recruitment",
        "sub": "Captain / First Officer (F/O) — hiring pilots with small-aircraft experience",
        "status": "Check official site",
        "statusTag": "gray",
        "details": [
          {
            "k": "Eligibility",
            "v": "Holder of a Commercial Pilot License (single- or multi-engine, instrument)"
          },
          {
            "k": "Location",
            "v": "Kagoshima Airport (Kagoshima Prefecture)"
          },
          {
            "k": "English",
            "v": "Aviation English Proficiency Level 4 or higher"
          }
        ],
        "note": "Hiring status varies by period; please check Shin Nihon Airlines' official site. Candidates with a strong passion for small aircraft and remote-island routes are welcome."
      },
      {
        "title": "General Application Requirements",
        "sub": "Baseline requirements for pilot applicants",
        "status": "General requirements",
        "statusTag": "gray",
        "details": [
          {
            "k": "License",
            "v": "Commercial Pilot License (airplane, single- or multi-engine land)"
          },
          {
            "k": "Instrument",
            "v": "Instrument Rating (preferred)"
          },
          {
            "k": "Medical",
            "v": "Class 1 aviation medical certificate"
          },
          {
            "k": "English",
            "v": "English ability (Aviation English Proficiency Level 4 or higher)"
          },
          {
            "k": "Mindset",
            "v": "A strong sense of mission for Kagoshima's islands and community contribution, plus teamwork"
          }
        ],
        "note": ""
      }
    ],
    "recruitUrl": ""
  },
  {
    "file": "solaseed.html",
    "code": "6J",
    "color": "#009EDB",
    "nameEn": "Solaseed Air",
    "subtitle": "The full-service carrier brightening the skies of Kyushu and Okinawa.",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🇯🇵 Japan"
      },
      {
        "cls": "tag-sky",
        "label": "FSC"
      },
      {
        "cls": "tag-gray",
        "label": "ANA Codeshare"
      },
      {
        "cls": "tag-gray",
        "label": "Kyushu & Okinawa"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "Boeing 737-800",
        "label": "Fleet"
      },
      {
        "val": "2002",
        "label": "Founded (ex-Skynet Asia)"
      }
    ],
    "overview": [
      "Solaseed Air was founded in 2002 as <strong>Skynet Asia Airways</strong> and rebranded to <strong>Solaseed Air</strong> in 2012. Based at Miyazaki Airport and Naha Airport, it operates domestic routes connecting Kyushu and Okinawa with Tokyo (Haneda) and Nagoya. Through codeshare and joint operations with ANA, it secures a stable route network.",
      "As its name — combining 'Sola' (sky) and 'Seed' — suggests, the airline's mission is to deliver the rich nature and culture of Kyushu and Okinawa to the whole of Japan. With the B737-800 as its mainstay aircraft, it maintains high customer satisfaction through warm service and affordable fares."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Miyazaki City, Miyazaki Prefecture"
      },
      {
        "k": "Founded",
        "v": "2002 (formerly Skynet Asia Airways)"
      },
      {
        "k": "Hub",
        "v": "Miyazaki (KMI) & Naha (OKA)"
      },
      {
        "k": "Codeshare",
        "v": "Joint operations with ANA"
      },
      {
        "k": "Airline Type",
        "v": "FSC"
      },
      {
        "k": "Retirement Age",
        "v": "65 (Captain)"
      }
    ],
    "salaryNote": "All compensation is denominated in Japanese yen (¥) and figures are pre-tax; Japan's standard income tax and social-insurance deductions apply. Performance-linked bonuses are paid 2–3 times per year. Pilots receive southern-route and remote-island allowances plus a Naha base allowance, and Captain duty allowances include a southern-route component. Loss-of-license insurance is provided for both on-duty and off-duty coverage.",
    "ops": {
      "routes": "Solaseed Air's core network centers on its two southern bases. Key routes include Miyazaki–Tokyo (Haneda); Naha–Tokyo (Haneda) and Naha–Nagoya (Chubu); Kumamoto, Nagasaki and Oita to Tokyo (Haneda); and Kagoshima to Tokyo and Osaka, with ANA codeshare flights extending connectivity nationwide. Operationally, crews contend with weather unique to Kyushu and Okinawa (typhoons and seasonal winds), fly the B737-800 efficiently on both domestic trunk and regional routes, support the region's tropical tourism and business demand, and operate flexibly under a two-base (Miyazaki/Naha) structure.",
      "fleet": "Boeing 737-800 (165 seats) as the mainstay aircraft, operated from two hubs at Miyazaki (KMI) and Naha (OKA), serving a Kyushu/Okinawa-focused southern-Japan network under an ANA codeshare partnership."
    },
    "training": [
      {
        "title": "B737-800 Type Rating",
        "body": "Type-rating training on the Boeing 737-800, mastering the latest glass-cockpit, EFIS and FMS operations. Safety is ensured through a training program aligned with ANA standards."
      },
      {
        "title": "Typhoon & Seasonal-Wind Training",
        "body": "Training to handle the typhoon season, seasonal winds, squalls and other weather conditions unique to Kyushu and Okinawa, with emphasis on southern-region meteorological knowledge and emergency-avoidance procedures."
      },
      {
        "title": "ANA Coordination & Codeshare Training",
        "body": "In line with joint operations with ANA, consistency with ANA's standard operating procedures (SOP) is maintained, embedding ANA-level quality and safety standards into daily operations."
      },
      {
        "title": "Captain Upgrade & Recurrent Checks",
        "body": "Captain upgrade assessments follow accumulated F/O experience, with recurrent proficiency checks 1–2 times per year. Emphasis is placed on continuous skill improvement and fostering a safety culture."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Flight Ticket Discounts",
        "body": "Discounted Solaseed Air tickets for pilots and their families, with ANA discounts also available on ANA codeshare flights."
      },
      {
        "icon": "🌺",
        "title": "Tropical Posting Support",
        "body": "Support for postings at the Miyazaki and Naha bases — a work location where you can enjoy rich nature and a southern-island lifestyle."
      },
      {
        "icon": "🏥",
        "title": "Health Insurance & Medical Care",
        "body": "Enrollment in the health-insurance association, dedicated pilot health-management support, and comprehensive loss-of-license insurance."
      },
      {
        "icon": "🏦",
        "title": "Retirement Allowance & Pension",
        "body": "A retirement-allowance scheme and corporate pension are provided, with a generous benefit design based on years of service."
      },
      {
        "icon": "👨‍👩‍👧",
        "title": "Childcare & Family-Care Leave",
        "body": "Childcare leave and reduced-hours work systems are in place. Male pilots have a track record of taking childcare leave, and family-care leave is also available."
      },
      {
        "icon": "📚",
        "title": "Training Cost Support",
        "body": "Type-rating training costs are covered by Solaseed Air, alongside a cost-support scheme for continuing education and skill development."
      }
    ],
    "hiringStatus": "Experienced-hire recruitment — status varies by season; confirm on the official Solaseed Air site (as of March 2026).",
    "hiringColor": "#009EDB",
    "jobs": [
      {
        "title": "Solaseed Air Pilot Recruitment",
        "sub": "First Officer (F/O) / Captain — Experienced Hires",
        "status": "Confirm on official site",
        "statusTag": "gray",
        "details": [
          {
            "k": "Eligibility",
            "v": "Commercial Pilot License (multi-engine & instrument) or Airline Transport Pilot License holder"
          },
          {
            "k": "Base",
            "v": "Miyazaki Airport or Naha Airport"
          },
          {
            "k": "English",
            "v": "Aviation English Proficiency certification, Level 4 or above"
          }
        ],
        "note": "Hiring status varies by season. Please confirm on the official Solaseed Air website."
      },
      {
        "title": "General Application Requirements",
        "sub": "Baseline eligibility for pilot applicants",
        "status": "All applicants",
        "statusTag": "blue",
        "details": [
          {
            "k": "License",
            "v": "Commercial Pilot License (airplane, multi-engine land) or higher"
          },
          {
            "k": "Instrument",
            "v": "Instrument flight rating held"
          },
          {
            "k": "Medical",
            "v": "Class 1 aviation medical certificate"
          },
          {
            "k": "English",
            "v": "Aviation English Proficiency certification, Level 4 or above"
          },
          {
            "k": "Aptitude",
            "v": "Motivation and adaptability to work in Kyushu/Okinawa"
          }
        ],
        "note": ""
      }
    ],
    "recruitUrl": "https://www.solaseedair.jp/company/recruit/"
  },
  {
    "file": "starflyer.html",
    "code": "7G",
    "color": "#8888cc",
    "nameEn": "StarFlyer (Star Flyer)",
    "subtitle": "Star Flyer — a Kitakyushu-based carrier delivering premium quality.",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🇯🇵 Japan"
      },
      {
        "cls": "tag-indigo",
        "label": "FSC"
      },
      {
        "cls": "tag-gray",
        "label": "ANA partnership"
      },
      {
        "cls": "tag-gray",
        "label": "Premium LCC"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "A320-200",
        "label": "Fleet in operation"
      },
      {
        "val": "2006",
        "label": "Launched · est. 2002"
      }
    ],
    "overview": [
      "StarFlyer, founded in 2002 and launched into service in 2006, is a Kitakyushu-based carrier that runs its own distinctive network. Positioning itself as a <strong>premium hybrid carrier that is \"neither an LCC nor an FSC,\"</strong> it differentiates itself from competitors through high-quality service — all-black leather seats throughout the cabin and generous seat pitch. It operates the Airbus A320-200 and has expanded its route network through partnership and codeshare arrangements with ANA.",
      "Based at Kitakyushu Airport and Fukuoka Airport, it operates domestic routes to Tokyo (Haneda) and Osaka (Kansai), as well as an international Kitakyushu–Seoul (Incheon) service. For pilots, a key strength is being able to gain experience on both domestic and international routes, plus time on the A320 — a type in high demand worldwide."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Kitakyushu, Fukuoka Prefecture"
      },
      {
        "k": "Founded / Launched",
        "v": "Founded 2002, launched 2006"
      },
      {
        "k": "Hub",
        "v": "Kitakyushu (KKJ) & Fukuoka (FUK)"
      },
      {
        "k": "Alliance",
        "v": "Partnered with ANA"
      },
      {
        "k": "Carrier type",
        "v": "FSC (hybrid)"
      },
      {
        "k": "Retirement Age",
        "v": "65 (Captain)"
      }
    ],
    "salaryNote": "Figures are pre-tax and denominated in Japanese yen (use the site's currency switcher to convert). Bonuses are paid two to three times a year and are performance-linked. A separate international-route allowance is added for the Seoul service, and loss-of-license insurance is provided for both on-duty and off-duty coverage.",
    "ops": {
      "routes": "StarFlyer's principal routes connect Kitakyushu and Fukuoka with Tokyo (Haneda) and Kitakyushu with Osaka (Kansai) on the domestic side, plus the international Kitakyushu–Seoul (Incheon) service and connecting routes on ANA codeshare flights. As a premium hybrid carrier it offers pilots a rare environment where they fly both domestic and international sectors; a world-standard A320 cockpit with ECAM operation; pride in high-quality service and strong passenger satisfaction; and flexible operations that make use of the two airports at Kitakyushu and Fukuoka.",
      "fleet": "Airbus A320-200 — a 150-seat single-aisle narrowbody, the carrier's operated type. Hubs at Kitakyushu (KKJ) and Fukuoka (FUK), covering domestic plus international (Seoul) routes, with ANA partnership codeshare flights."
    },
    "training": [
      {
        "title": "Airbus A320 Type Rating",
        "body": "Type-rating training on the Airbus A320, one of the world's most widely operated aircraft. You master Airbus's advanced systems — fly-by-wire (FBW), ECAM and FMGC. It is a qualification in high demand internationally."
      },
      {
        "title": "Domestic & international line training",
        "body": "In addition to domestic operations, training covers the Seoul (Incheon) international service. You learn English ATC communication, ICAO international standards, and operating procedures at overseas airports."
      },
      {
        "title": "ANA-aligned training",
        "body": "In line with the ANA partnership and codeshare, training and operating procedures follow ANA standards, delivering ANA-level safety and quality in day-to-day operations."
      },
      {
        "title": "Captain upgrade & recurrent checks",
        "body": "Captain upgrade assessment after building First Officer experience. Recurrent proficiency checks held one to two times a year confirm continuous skill improvement. As an independent carrier, it offers a fast-paced upgrade environment."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Airfare discounts",
        "body": "Discounted StarFlyer tickets for employees and their families. Discounts on ANA partner flights can also be used."
      },
      {
        "icon": "🌟",
        "title": "Pride in premium quality",
        "body": "Delivers the high-quality service that makes a \"premium journey through the skies\" a reality. High praise from passengers fuels pilots' motivation."
      },
      {
        "icon": "🏥",
        "title": "Health insurance & medical care",
        "body": "Membership in the company health insurance society, with pilot-specific health-management support and loss-of-license insurance included."
      },
      {
        "icon": "🏦",
        "title": "Retirement allowance & pension",
        "body": "Retirement allowance scheme and corporate pension provided, with a generous benefit design scaled to years of service."
      },
      {
        "icon": "👨‍👩‍👧",
        "title": "Childcare & nursing-care leave",
        "body": "Childcare leave and reduced-hours working systems in place, with a track record of male pilots taking childcare leave. Nursing-care leave is also established."
      },
      {
        "icon": "🌏",
        "title": "International-route allowance",
        "body": "A separate overseas-layover allowance and special international-route allowance are paid for international duties such as the Seoul route."
      }
    ],
    "hiringStatus": "Hiring availability varies by period — confirm on the official site",
    "jobs": [
      {
        "title": "StarFlyer Pilot Recruitment",
        "sub": "First Officer (F/O) / Captain — experienced-hire",
        "status": "Check official site",
        "statusTag": "gray",
        "details": [
          {
            "k": "Eligibility",
            "v": "Holder of a Commercial Pilot License (multi-engine & instrument) or an Airline Transport Pilot License"
          },
          {
            "k": "Base",
            "v": "Kitakyushu Airport or Fukuoka Airport (Fukuoka Prefecture)"
          },
          {
            "k": "English",
            "v": "Aviation English Proficiency Certificate Level 4 or above (Level 5 recommended for international operations)"
          }
        ],
        "note": "Hiring availability varies by period. Please confirm on StarFlyer's official website."
      },
      {
        "title": "General application requirements",
        "sub": "Baseline license, medical and English criteria",
        "status": "Reference",
        "statusTag": "gray",
        "details": [
          {
            "k": "License",
            "v": "Commercial Pilot License (airplane, multi-engine land) or above"
          },
          {
            "k": "Instrument rating",
            "v": "Instrument flight rating held"
          },
          {
            "k": "Medical",
            "v": "First-class aviation medical certificate"
          },
          {
            "k": "English",
            "v": "English ability (Aviation English Proficiency Level 4 or above; strong English preferred for international operations)"
          },
          {
            "k": "Fit",
            "v": "Affinity for premium service and a high-quality mindset"
          }
        ],
        "note": ""
      }
    ],
    "recruitUrl": "https://www.starflyer.jp/company/recruit/"
  },
  {
    "file": "toho-air.html",
    "code": "TH",
    "color": "#CC6600",
    "nameEn": "Toho Air Service",
    "subtitle": "A helicopter and light-aircraft specialist keeping Okinawa's remote islands connected.",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🇯🇵 Japan"
      },
      {
        "cls": "tag-toho",
        "label": "Helicopter"
      },
      {
        "cls": "tag-gray",
        "label": "Okinawa Remote Islands"
      },
      {
        "cls": "tag-gray",
        "label": "Light Aircraft"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "S-76 / Bell 412",
        "label": "Helicopters"
      },
      {
        "val": "Founded 1964",
        "label": "Naha Airport base"
      }
    ],
    "overview": [
      "Toho Air Service is an independent, Okinawa-based airline founded in 1964. Using helicopters (the Sikorsky S-76 and Bell 412) and fixed-wing light aircraft (the DHC-6 Twin Otter), it operates helicopter and light-aircraft routes to Okinawa's remote islands such as Aguni Island and Kumejima. The company also provides corporate charter flights and offshore oil-field support services.",
      "Flying Okinawa's beautiful skies as a helicopter pilot offers an appeal quite different from fixed-wing flying. Helicopter handling is highly demanding, calling for distinctive skills such as VFR flight, low-altitude flying, and precision landings. As a stable company with more than 60 years of history, it lets pilots obtain and maintain licenses for both helicopters and light aircraft."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Naha City, Okinawa Prefecture"
      },
      {
        "k": "Founded",
        "v": "1964"
      },
      {
        "k": "Hub",
        "v": "Naha Airport"
      },
      {
        "k": "Group",
        "v": "Independent"
      },
      {
        "k": "Airline Type",
        "v": "FSC (helicopter & light aircraft)"
      },
      {
        "k": "Destinations",
        "v": "Okinawa remote islands & charter"
      }
    ],
    "salaryNote": "All figures are pre-tax and shown in Japanese yen (¥); Japanese income tax applies to pilot earnings. Bonuses are paid twice a year in line with independent-carrier practice. Remote-island and Okinawa allowances are paid separately and added according to route and mission. Loss-of-license insurance is provided, covering both on-duty and off-duty incidents.",
    "ops": {
      "routes": "Toho Air Service's main operations include the Naha–Aguni Island helicopter route and the Naha–Kumejima route (served by both helicopters and fixed-wing aircraft), along with charter flights for corporate and government clients, maritime and remote-island emergency-transport support, and aerial-photography and survey work. Helicopter operations here demand precise vertical take-off, landing and hovering techniques, the ability to cope with Okinawa's maritime weather and typhoons, and readiness for night flying and special missions; pilots qualified on both helicopters and fixed-wing aircraft are especially valued.",
      "fleet": "Sikorsky S-76 (medium helicopter), Bell 412 (multipurpose helicopter), and DHC-6 Twin Otter (fixed-wing light aircraft), all operated from the Naha base within Okinawa Prefecture."
    },
    "training": [
      {
        "title": "Helicopter Type-Rating Training",
        "body": "Type-rating training is conducted on the Sikorsky S-76 and Bell 412. Pilots master the complex systems, autopilot, and instrument flying of twin-engine turbine helicopters, and highly advanced handling skills are required."
      },
      {
        "title": "Okinawa & Over-Water Flight Training",
        "body": "Training to handle Okinawa's maritime weather (typhoons, squalls, and strong winds). Pilots acquire Okinawa-specific skills such as over-water hovering, approaches to remote islands, and emergency-landing techniques."
      },
      {
        "title": "Combined Fixed-Wing & Helicopter Training",
        "body": "The opportunity to hold and maintain both helicopter and fixed-wing licenses. Mastering the different handling characteristics and safety management of each builds broad insight as a pilot."
      },
      {
        "title": "Captain Upgrade & Recurrent Checks",
        "body": "Upgrade to helicopter captain requires abundant flight hours and a high-level skill assessment. Recurrent proficiency checks one to two times a year maintain a continuous safety standard."
      }
    ],
    "benefits": [
      {
        "icon": "🚁",
        "title": "Helicopter Career",
        "body": "As one of Japan's rare pilots on helicopter passenger routes, you can build unique expertise and a distinctive career."
      },
      {
        "icon": "🌺",
        "title": "Okinawa Living Support",
        "body": "Based in Naha, enjoy Okinawa's rich nature and culture every day — a fulfilling lifestyle in a resort setting."
      },
      {
        "icon": "🏥",
        "title": "Health Insurance & Medical",
        "body": "Enrollment in the company health-insurance society, dedicated pilot health-management support, and full loss-of-license insurance."
      },
      {
        "icon": "🏦",
        "title": "Retirement Pay & Pension",
        "body": "A complete retirement-pay scheme, backed by a stable corporate foundation with more than 60 years of history."
      },
      {
        "icon": "🎓",
        "title": "Multiple Type Ratings",
        "body": "Support for obtaining and maintaining both helicopter and fixed-wing qualifications, enabling a diverse set of piloting skills."
      },
      {
        "icon": "📚",
        "title": "Training Cost Support",
        "body": "Type-rating training costs are covered by Toho Air Service, and a support scheme also covers helicopter proficiency-check costs."
      }
    ],
    "hiringStatus": "Check the official site for current hiring status (as of March 2026)",
    "jobs": [
      {
        "title": "Toho Air Service Pilot Recruitment",
        "sub": "Captain / First Officer (F/O) — helicopter and fixed-wing experience",
        "status": "Check official site",
        "statusTag": "gray",
        "details": [
          {
            "k": "Eligibility",
            "v": "Holder of a Commercial Pilot License (rotorcraft or aeroplane)"
          },
          {
            "k": "Location",
            "v": "Naha Airport, Okinawa Prefecture"
          },
          {
            "k": "English requirement",
            "v": "Aviation English Proficiency Level 4 or above"
          }
        ],
        "note": "Hiring status varies by period; please check the Toho Air Service official website. Both helicopter-experienced and fixed-wing-experienced pilots are welcome to apply."
      },
      {
        "title": "General Application Requirements",
        "sub": "Baseline eligibility for pilot applicants",
        "status": "Baseline requirements",
        "statusTag": "blue",
        "details": [
          {
            "k": "License",
            "v": "Commercial Pilot License (rotorcraft or aeroplane)"
          },
          {
            "k": "Instrument Rating",
            "v": "Instrument rating held (preferred)"
          },
          {
            "k": "Medical",
            "v": "First-class aviation medical certificate"
          },
          {
            "k": "English",
            "v": "Aviation English Proficiency Level 4 or above"
          },
          {
            "k": "Commitment",
            "v": "A strong sense of mission and passion for working in Okinawa and supporting its remote islands"
          }
        ],
        "note": ""
      }
    ],
    "recruitUrl": "https://www.tohoair.co.jp/recruit/"
  },
  {
    "file": "toki-air.html",
    "code": "JO",
    "color": "#00A0C6",
    "nameEn": "Toki Air",
    "subtitle": "Toki Air — an up-and-coming regional airline based in Niigata that launched services in 2024.",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🇯🇵 Japan"
      },
      {
        "cls": "tag-toki",
        "label": "FSC"
      },
      {
        "cls": "tag-gold",
        "label": "Launched 2024"
      },
      {
        "cls": "tag-gray",
        "label": "ATR fleet"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "ATR 72-600",
        "label": "Fleet type"
      },
      {
        "val": "Launched 2024",
        "label": "Founded 2019"
      }
    ],
    "overview": [
      "Toki Air is an independent, emerging regional airline that was founded in Niigata City in 2019 and launched commercial services in January 2024. Based at Niigata Airport, it operates routes to destinations such as Okadama (Sapporo), Nagoya and Naha. The company's name derives from the crested ibis (<strong>toki</strong>), a Special Natural Monument of Niigata Prefecture, expressing its affection for the region as a symbol of Niigata's skies.",
      "It operates the latest-generation ATR 72-600 turboprop and aims for sustainable aviation with outstanding fuel efficiency and environmental performance. Because services began so recently, it offers pilots a rewarding environment in which they can gain the valuable experience of supporting the company from its founding period. As an independent carrier, it is characterized by fast decision-making and a flexible workplace culture."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Niigata City, Niigata Prefecture"
      },
      {
        "k": "Founded / Launched",
        "v": "Founded 2019, launched 2024"
      },
      {
        "k": "Hub",
        "v": "Niigata Airport (KIJ)"
      },
      {
        "k": "Group",
        "v": "Independent"
      },
      {
        "k": "Airline Type",
        "v": "FSC (regional)"
      },
      {
        "k": "Callsign",
        "v": "JO (Toki Air)"
      }
    ],
    "salaryNote": "Compensation is paid in Japanese yen (figures are pre-tax; standard Japanese income tax applies). A bonus is paid twice a year on a performance-linked basis and is being expanded as the airline grows. A separate Niigata work allowance (regional allowance) is provided in addition to base pay, and pilots receive a flight (duty) allowance — framed as a new-airline package for captains and a start-up allowance for first officers. Loss-of-license insurance is in place, covering both on-duty and off-duty incidents. Amounts are in JPY; convert to your local currency for comparison.",
    "ops": {
      "routes": "Toki Air is building out its route network from its Niigata base. Current scheduled routes include Niigata ⇄ Okadama (Sapporo), serving Hokkaido; Niigata ⇄ Nagoya (Komaki); and Niigata ⇄ Naha, a north–south route spanning the length of Japan — with further route expansion planned as the Niigata-centered network is developed. As an emerging carrier, it offers the latest ATR 72-600 turboprop technology, the reward of supporting the company's growth from its founding period, hands-on experience with Niigata's distinctive weather (rough winter conditions on the Sea of Japan side), and a flexible operating structure run by a small, elite team.",
      "fleet": "ATR 72-600 — a 70-seat, latest-generation ATR turboprop. Operations are centered on a single hub at Niigata (KIJ). As an independent, emerging carrier that launched in 2024, the fleet and route network are still being built out and expanding."
    },
    "training": [
      {
        "title": "ATR 72-600 Type Rating",
        "body": "Type-rating training on the ATR 72-600 is conducted at ATR-certified simulator facilities. Pilots master advanced systems including the latest glass cockpit, FMS and ACARS. The ATR 72-600 is a next-generation turboprop with excellent environmental performance."
      },
      {
        "title": "Sea of Japan / Niigata-specific weather training",
        "body": "Training to handle the rough weather characteristic of the Sea of Japan side in winter (strong winds, snowfall, low visibility). Pilots learn the meteorological characteristics of Niigata Airport and hone the skills to operate safely under any conditions."
      },
      {
        "title": "A founding-era training environment",
        "body": "A training setup unique to a newly established airline in its early days of operation. Thanks to small class sizes, pilots receive dense, hands-on instruction and can experience a wide range of duties early on — including the chance to help build the rules and culture themselves."
      },
      {
        "title": "Captain upgrade and recurrent checks",
        "body": "As a new airline, opportunities for upgrade to captain positions tend to be plentiful. Ongoing proficiency is verified through recurrent proficiency checks once or twice a year, in compliance with the review standards of Japan's Ministry of Land, Infrastructure, Transport and Tourism (MLIT)."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Flight ticket discounts",
        "body": "Discounted Toki Air tickets for employees and their families. As a founding-era employee, you can take part in shaping the discount program itself."
      },
      {
        "icon": "🌾",
        "title": "Niigata living support",
        "body": "Niigata Prefecture's rich food culture (Koshihikari rice, sake, seafood) and natural environment. A fulfilling living environment that is also close to ski resorts."
      },
      {
        "icon": "🏥",
        "title": "Health insurance & medical",
        "body": "Enrollment in the company health insurance society. Pilot-specific health management support. Loss-of-license insurance fully provided."
      },
      {
        "icon": "🚀",
        "title": "Start-up growth opportunity",
        "body": "A valuable chance to join a newly established airline from its founding period. Build your career alongside the company's growth, with the possibility of contributing from a position close to management."
      },
      {
        "icon": "👨‍👩‍👧",
        "title": "Childcare & family-care leave",
        "body": "Childcare-leave and family-care-leave systems are in place. A small, elite team is building an environment where colleagues support one another and it is easy to work."
      },
      {
        "icon": "📚",
        "title": "Training cost support",
        "body": "Type-rating training costs are covered by Toki Air. As a new company, its programs are being continuously developed, with enhancements planned as the company grows."
      }
    ],
    "hiringStatus": "Actively hiring",
    "hiringColor": "#34d399",
    "jobs": [
      {
        "title": "Toki Air Pilot Recruitment",
        "sub": "First Officer (F/O) / Captain — experienced-hire recruitment (actively hiring to expand services)",
        "status": "Actively hiring",
        "statusTag": "green",
        "details": [
          {
            "k": "Eligibility",
            "v": "Holder of a Commercial Pilot License (multi-engine / instrument) or an Airline Transport Pilot License"
          },
          {
            "k": "Location",
            "v": "Niigata Airport, Niigata Prefecture"
          },
          {
            "k": "English",
            "v": "Aviation English Proficiency Certificate, Level 4 or above"
          }
        ],
        "note": "Actively hiring, as the airline is in an early growth stage soon after launch. Please check the official Toki Air website for the latest information."
      },
      {
        "title": "General application requirements",
        "sub": "Standard eligibility criteria for pilot applicants",
        "status": "Requirements",
        "statusTag": "gray",
        "details": [
          {
            "k": "License",
            "v": "Commercial Pilot License (airplane, multi-engine land) or above"
          },
          {
            "k": "Instrument rating",
            "v": "Instrument flight rating held"
          },
          {
            "k": "Medical",
            "v": "First-class aviation medical certificate"
          },
          {
            "k": "English",
            "v": "Aviation English Proficiency Certificate, Level 4 or above"
          },
          {
            "k": "Mindset",
            "v": "Affinity for start-ups and a passion for advancing regional aviation"
          }
        ],
        "note": ""
      }
    ],
    "recruitUrl": "https://tokiair.com/recruit/"
  },
  {
    "file": "aegean.html",
    "code": "A3",
    "color": "#00539C",
    "nameEn": "Aegean Airlines",
    "subtitle": "Aegean Airlines — Greece's largest airline · Star Alliance member",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🇬🇷 Greece"
      },
      {
        "cls": "tag-blue",
        "label": "Star Alliance"
      },
      {
        "cls": "tag-gray",
        "label": "FSC/LCC hybrid"
      },
      {
        "cls": "tag-orange",
        "label": "Europe"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "~70",
        "label": "Fleet Size"
      },
      {
        "val": "150+",
        "label": "Destinations"
      }
    ],
    "overview": [
      "Aegean Airlines is Greece's largest airline, operating from its Athens hub across the Mediterranean, all of Europe, the Middle East, and North Africa. It is a Star Alliance member. Relative to the size of the Greek economy, it maintains an unusually extensive network, with demand peaking sharply during the summer tourist season. The fleet is built around the A320 family and operations follow EASA standards. Income tax is Greek (up to 44%)."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Athens (Greece)"
      },
      {
        "k": "Hub",
        "v": "Athens Eleftherios Venizelos Airport (ATH)"
      },
      {
        "k": "Alliance",
        "v": "Star Alliance"
      },
      {
        "k": "Founded",
        "v": "1987"
      },
      {
        "k": "Fleet Size",
        "v": "~70 aircraft"
      },
      {
        "k": "Income Tax",
        "v": "Yes (up to 44%)"
      }
    ],
    "salaryNote": "Pay is denominated in euros and set on a seniority system, quoted pre-tax. Figures are converted at EUR/JPY = 163. Greek income tax reaches a maximum of 44%. The cost of living in Athens is relatively low compared with Western Europe.",
    "ops": {
      "routes": "From its Athens hub, Aegean serves all of Europe (London, Paris, Frankfurt, and more), the Mediterranean, North Africa, and the Middle East. It also operates numerous domestic routes to the Greek islands.",
      "fleet": "Airbus A321neo, A320neo, A320ceo, and A319. Around 70 aircraft."
    },
    "training": [
      {
        "title": "Type Rating (EASA-approved — watch for cost liability)",
        "body": "Training is conducted at an EASA-approved ATO. At LCCs, some contract structures require the pilot to bear part or all of the type-rating cost — confirm the terms."
      },
      {
        "title": "LIFUS",
        "body": "After obtaining the type rating, line training is flown with an instructor captain on board. At LCCs with many short-haul routes, pilots can build up their leg count relatively quickly."
      },
      {
        "title": "Recurrent Checks (OPC/LPC)",
        "body": "Checks are held once or twice a year based on EASA standards. LCCs apply the same safety standards."
      },
      {
        "title": "Upgrade",
        "body": "FO-to-Captain upgrade typically requires a minimum of 4,000-5,000 flight hours or more. LCCs can offer more frequent upgrade opportunities."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Staff Discounts",
        "body": "Discounted or free travel on the airline's own flights. Often extends to group and partner carriers."
      },
      {
        "icon": "🏥",
        "title": "Medical Insurance",
        "body": "Basic medical insurance (in Europe, combined with the EHIC / public health-care systems)."
      },
      {
        "icon": "📈",
        "title": "Productivity Bonus",
        "body": "Duty pay or a productivity bonus, usually tied to flight hours and number of legs."
      },
      {
        "icon": "📅",
        "title": "Paid Leave",
        "body": "A minimum of 20 days or more under the EU directive, in accordance with each country's law."
      },
      {
        "icon": "🏠",
        "title": "Base City Allowance",
        "body": "An allowance for working at a chosen base city (London, Madrid, etc.)."
      }
    ],
    "hiringStatus": "Recruiting on a regular basis. Open to holders of an EASA ATPL.",
    "hiringColor": "#34d399",
    "jobs": [
      {
        "title": "Captain / First Officer (regular recruitment)",
        "sub": "European routes. Athens-based.",
        "status": "Recruiting",
        "statusTag": "green",
        "details": [
          {
            "k": "License",
            "v": "EASA ATPL (HCAA-issued)"
          },
          {
            "k": "English",
            "v": "ICAO Level 4 or above"
          },
          {
            "k": "Min. Flight Hours",
            "v": "Captain 4,000h+ (guideline)"
          },
          {
            "k": "Type Rating",
            "v": "A320 family preferred"
          }
        ],
        "note": "Recruitment activity tends to intensify during Greece's summer peak (April-October)."
      }
    ],
    "recruitUrl": "https://www.aegeanair.com/en/aegean-group/careers/"
  },
  {
    "file": "aer-lingus.html",
    "code": "EI",
    "color": "#00A84F",
    "nameEn": "Aer Lingus",
    "subtitle": "Ireland's flag carrier and a member of the IAG Group.",
    "tags": [
      {
        "cls": "tag-green",
        "label": "🇮🇪 Ireland"
      },
      {
        "cls": "tag-blue",
        "label": "Oneworld (IAG)"
      },
      {
        "cls": "tag-gray",
        "label": "FSC"
      },
      {
        "cls": "tag-gold",
        "label": "North Atlantic Routes"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "~70",
        "label": "Fleet Size"
      },
      {
        "val": "100+",
        "label": "Cities Served"
      }
    ],
    "overview": [
      "Aer Lingus is Ireland's flag carrier, founded in <strong>1936</strong>. Using Dublin as its hub, it serves North America (transatlantic routes) and destinations across Europe. It is part of the IAG Group and a member of the Oneworld alliance. Ireland is able to offer preclearance (advance US Customs & Border Protection screening) at Dublin, underpinning a business model specialized in North American routes. The A320 family and the A330 form the backbone of the fleet. Ireland's low corporate-tax environment is another distinctive feature."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Dublin, Ireland"
      },
      {
        "k": "Hub",
        "v": "Dublin Airport (DUB)"
      },
      {
        "k": "Alliance",
        "v": "Oneworld (IAG)"
      },
      {
        "k": "Founded",
        "v": "1936"
      },
      {
        "k": "Fleet",
        "v": "~70 aircraft"
      },
      {
        "k": "Income Tax",
        "v": "Yes (up to 40%)"
      }
    ],
    "salaryNote": "Salaries are denominated in EUR and quoted pre-tax. Progression follows a seniority system. Ireland's income tax reaches a top rate of 40%. Figures are converted at EUR/JPY = 163. Dublin is an English-speaking city where Japanese residents find it relatively easy to settle.",
    "ops": {
      "routes": "From its Dublin hub, Aer Lingus serves North America (New York, Boston, Chicago, Los Angeles, etc.) and destinations across Europe (London, Amsterdam, Paris, etc.).",
      "fleet": "Airbus A330-200/300, A321neo/LR, A320neo and A319. Around 70 aircraft."
    },
    "training": [
      {
        "title": "Type Rating (EASA-approved ATO)",
        "body": "Type rating obtained at an EASA-certified Approved Training Organisation (ATO). Ground school → simulator (including MCC) → LIFUS."
      },
      {
        "title": "LIFUS (Line Training)",
        "body": "After the type rating, Line Flying Under Supervision is conducted with an instructor captain on board — typically around 50–80 legs (in accordance with EASA FCL.060)."
      },
      {
        "title": "Recurrent Checks (OPC/LPC)",
        "body": "Proficiency Checks (PC) once or twice a year, to EASA FCL.625/735 standards, overseen by the relevant national CAA (CAA UK, DGAC, LBA, etc.)."
      },
      {
        "title": "Captain Upgrade & Additional Ratings",
        "body": "After a period as SFO / Senior F/O, captain training follows. Additional qualifications such as LVP (low-visibility procedures), PBN, ETOPS and RVSM are also obtained."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Staff Travel",
        "body": "Heavily discounted or free flights for the employee and their family, usable on alliance partner airlines as well."
      },
      {
        "icon": "🏥",
        "title": "Health Insurance",
        "body": "High-standard European health insurance. Loss-of-licence insurance is also common."
      },
      {
        "icon": "💰",
        "title": "Bonus",
        "body": "Performance-linked bonus (equivalent to 2–4 months' pay per year), in some cases tied to individual performance appraisals."
      },
      {
        "icon": "📅",
        "title": "Paid Leave",
        "body": "25–35 days per year — a generous leave system underpinned by European labour law (EU directives)."
      },
      {
        "icon": "🏦",
        "title": "Retirement & Company Pension",
        "body": "A defined-benefit or defined-contribution occupational pension (DBP/DCP). In Europe this sits alongside the state pension in a two-tier structure."
      },
      {
        "icon": "🌐",
        "title": "Layover Allowance",
        "body": "Accommodation and per-diem paid for overseas stays; allowances are higher for high-cost major European cities."
      }
    ],
    "hiringStatus": "Recruiting on a regular basis — open to holders of an EASA ATPL.",
    "hiringColor": "#34d399",
    "jobs": [
      {
        "title": "Captain & First Officer (Regular Intake)",
        "sub": "International operations. Dublin-based.",
        "status": "Now Hiring",
        "statusTag": "green",
        "details": [
          {
            "k": "License",
            "v": "EASA ATPL (IAA-issued)"
          },
          {
            "k": "English",
            "v": "ICAO Level 4 or above (English-native environment)"
          },
          {
            "k": "Minimum Flight Hours",
            "v": "5,000+ hrs for Captain"
          },
          {
            "k": "Type Rating",
            "v": "A330/A321 preferred"
          }
        ],
        "note": "Opportunities for transfer within the IAG Group (British Airways, Iberia, etc.). Dublin's English-speaking environment is easy for Japanese pilots to adjust to."
      }
    ],
    "recruitUrl": "https://www.aerlingus.com/information/careers/"
  },
  {
    "code": "OS",
    "color": "#CC0000",
    "file": "austrian.html",
    "nameEn": "Austrian Airlines",
    "subtitle": "Austria's flag carrier, part of the Lufthansa Group.",
    "tags": [
      {
        "cls": "tag-red",
        "label": "🇦🇹 Austria"
      },
      {
        "cls": "tag-blue",
        "label": "Star Alliance"
      },
      {
        "cls": "tag-gray",
        "label": "FSC"
      },
      {
        "cls": "tag-orange",
        "label": "Lufthansa Group"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "~75",
        "label": "Fleet Size"
      },
      {
        "val": "130+",
        "label": "Destinations"
      }
    ],
    "overview": [
      "Austrian Airlines is Austria's flag carrier, hubbed at Vienna. A member of the Lufthansa Group and part of the Star Alliance, it offers particularly strong access to Central and Eastern Europe, with Vienna serving as a key hub connecting Europe with the countries of the former Eastern Bloc. Its operations are diverse, ranging from long-haul routes flown by the B777 and B787 to intra-European routes flown by the A320/A321."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Vienna, Austria"
      },
      {
        "k": "Hub",
        "v": "Vienna Airport (VIE)"
      },
      {
        "k": "Alliance",
        "v": "Star Alliance"
      },
      {
        "k": "Founded",
        "v": "1957"
      },
      {
        "k": "Fleet Size",
        "v": "~75 aircraft"
      },
      {
        "k": "Income Tax",
        "v": "Yes (up to 55%)"
      }
    ],
    "salaryNote": "Salaries are denominated in EUR and quoted pre-tax, with pay following a seniority-based structure. Austria's income tax reaches up to 55%, among the highest in Europe. JPY figures on the site are converted at an EUR/JPY rate of 163.",
    "ops": {
      "routes": "From its Vienna hub, the airline serves Central and Eastern Europe (Prague, Warsaw, Budapest, etc.), North America (New York, Washington, Los Angeles, etc.), Asia, Africa and the Middle East.",
      "fleet": "Boeing 777-200ER, B787-9, Airbus A321neo, A321ceo, A320neo. Around 75 aircraft."
    },
    "training": [
      {
        "title": "Type Rating (EASA-approved ATO)",
        "body": "Type rating training is completed at an EASA-certified Approved Training Organisation (ATO). Ground school → simulator (including MCC) → LIFUS."
      },
      {
        "title": "LIFUS (Line Training)",
        "body": "After obtaining the type rating, pilots conduct Line Flying Under Supervision alongside an instructor captain — typically around 50–80 legs (per EASA FCL.060)."
      },
      {
        "title": "Recurrent Checks (OPC/LPC)",
        "body": "Proficiency Checks (PC) are conducted once or twice a year to EASA FCL.625/735 standards, overseen by the relevant national CAAs (CAA UK, DGAC, LBA, etc.)."
      },
      {
        "title": "Captain Upgrade & Additional Ratings",
        "body": "After a period as SFO/Senior F/O, pilots undergo captain training. Additional qualifications such as LVP (Low Visibility Procedures), PBN, ETOPS and RVSM are also obtained."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Staff Travel",
        "body": "Heavily discounted or free flights for the employee and their family, also usable on alliance partner carriers."
      },
      {
        "icon": "🏥",
        "title": "Medical Insurance",
        "body": "High-standard European medical insurance. Loss-of-licence insurance is also common."
      },
      {
        "icon": "💰",
        "title": "Bonus",
        "body": "Performance-linked bonus (equivalent to 2–4 months' pay per year), in some cases tied to performance evaluations."
      },
      {
        "icon": "📅",
        "title": "Paid Leave",
        "body": "25–35 days per year — a generous leave system under European labour law (EU directives)."
      },
      {
        "icon": "🏦",
        "title": "Pension & Corporate Retirement Plan",
        "body": "Defined-benefit or defined-contribution corporate pension (DBP/DCP). In Europe this sits alongside the state pension in a two-tier structure."
      },
      {
        "icon": "🌐",
        "title": "Layover Allowance",
        "body": "Accommodation and per-diem provided for overseas stays; major European cities attract higher high-cost-area allowances."
      }
    ],
    "hiringStatus": "Hiring via the Lufthansa Group; open to holders of an EASA ATPL.",
    "hiringColor": "#f5c842",
    "jobs": [
      {
        "title": "Captain / First Officer (Regular Recruitment)",
        "sub": "International operations. Vienna-based.",
        "status": "Check Official Site",
        "statusTag": "blue",
        "details": [
          {
            "k": "License",
            "v": "EASA ATPL (Austro Control approved)"
          },
          {
            "k": "English",
            "v": "ICAO Level 4 or higher"
          },
          {
            "k": "Minimum Flight Hours",
            "v": "Captain 5,000h+"
          },
          {
            "k": "German",
            "v": "Conversational level recommended"
          }
        ],
        "note": "Austria offers a culturally accessible environment for Japanese pilots considering working and living within the EU."
      }
    ],
    "recruitUrl": "https://karriere.austrian.com"
  },
  {
    "file": "easyjet.html",
    "code": "U2",
    "color": "#FF6600",
    "nameEn": "easyJet",
    "subtitle": "easyJet — the UK's largest low-cost carrier, operating across the whole of Europe.",
    "tags": [
      {
        "cls": "tag-orange",
        "label": "🇬🇧 United Kingdom"
      },
      {
        "cls": "tag-orange",
        "label": "LCC"
      },
      {
        "cls": "tag-gray",
        "label": "Independent"
      },
      {
        "cls": "tag-blue",
        "label": "Europe"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "~350",
        "label": "Fleet Size"
      },
      {
        "val": "150+",
        "label": "Destination Cities"
      }
    ],
    "overview": [
      "easyJet is a low-cost carrier founded with its base at London Luton Airport, and today it connects more than 150 cities across the whole of Europe. It maintains major bases in London, Amsterdam, Geneva, Milan and elsewhere. Its fleet is standardized on the A320 family. Following Brexit, easyJet established <strong>easyJet Europe</strong> as an EU subsidiary to preserve its European route network. Pilots require a <strong>UK CAA / EASA ATPL</strong>."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Luton (United Kingdom)"
      },
      {
        "k": "Hub",
        "v": "Luton, Gatwick, Amsterdam and others"
      },
      {
        "k": "Alliance",
        "v": "None (independent)"
      },
      {
        "k": "Founded",
        "v": "1995"
      },
      {
        "k": "Fleet Size",
        "v": "~350 aircraft"
      },
      {
        "k": "Income Tax",
        "v": "Per each country's law (country of base)"
      }
    ],
    "salaryNote": "Pay is GBP-denominated and quoted pre-tax for UK-based crew (GBP/JPY converted at 190 for UK bases); crew at EU bases are paid in EUR. First Officer pay follows a seniority-based system. Actual take-home pay varies significantly depending on the cost of living in the chosen base city.",
    "ops": {
      "routes": "Operates from multiple bases — including London, Amsterdam, Geneva, Madrid and Milan — to destinations across the whole of Europe, North Africa and the Middle East. Specializes in short- and medium-haul routes.",
      "fleet": "Airbus A321neo, A320neo, A320ceo and A319. Around 350 aircraft."
    },
    "training": [
      {
        "title": "Type Rating (EASA-approved — note on cost sharing)",
        "body": "Conducted at EASA-approved ATOs. At LCCs, some contract structures require the pilot to bear part or all of the type-rating cost, so the terms should be confirmed."
      },
      {
        "title": "LIFUS",
        "body": "Line training under a supervising instructor captain after obtaining the type rating. Because LCCs fly many short-haul sectors, pilots can build up their leg counts relatively quickly."
      },
      {
        "title": "Recurrent Checks (OPC/LPC)",
        "body": "Checks are held once or twice a year in line with EASA standards. LCCs apply the same safety standards as full-service carriers."
      },
      {
        "title": "Upgrade",
        "body": "Upgrade from First Officer to Captain typically requires a minimum of 4,000–5,000+ flight hours as a guideline. LCCs can also offer more frequent upgrade opportunities."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Staff Travel Discounts",
        "body": "Discounted or free travel on the airline's own flights. Often extended to group and partner airlines."
      },
      {
        "icon": "🏥",
        "title": "Medical Insurance",
        "body": "Basic medical insurance (in Europe, combined with the EHIC / public healthcare systems)."
      },
      {
        "icon": "📈",
        "title": "Productivity Bonus",
        "body": "Duty pay or productivity bonuses, frequently linked to flight hours and sector (leg) counts."
      },
      {
        "icon": "📅",
        "title": "Paid Leave",
        "body": "A minimum of 20+ days in line with EU directives, in accordance with each country's law."
      },
      {
        "icon": "🏠",
        "title": "Base City Allowance",
        "body": "A duty allowance for working at the chosen base city (London, Madrid, etc.)."
      },
      {
        "icon": "📊",
        "title": "Incentive Pay",
        "body": "Additional pay linked to flight hours and productivity. Peak seasons offer the chance to increase earnings."
      }
    ],
    "hiringStatus": "Hiring continuously. Open to holders of a UK CAA / EASA ATPL.",
    "hiringColor": "#34d399",
    "jobs": [
      {
        "title": "Captain / First Officer (continuous recruitment)",
        "sub": "European route flying. Choice of multiple bases.",
        "status": "Hiring continuously",
        "statusTag": "green",
        "details": [
          {
            "k": "Required license",
            "v": "UK CAA / EASA ATPL"
          },
          {
            "k": "English",
            "v": "ICAO Level 4 or above"
          },
          {
            "k": "Minimum flight hours",
            "v": "F/O: 500h+, Captain: 4,000h+ (guideline)"
          },
          {
            "k": "Type rating",
            "v": "A320 family (company may cover training costs in some cases)"
          }
        ],
        "note": "Under the easyJet GenX programme, some courses have the company cover the type-rating cost (conditions apply)."
      }
    ],
    "recruitUrl": "https://careers.easyjet.com"
  },
  {
    "file": "icelandair.html",
    "code": "FI",
    "color": "#003087",
    "nameEn": "Icelandair",
    "subtitle": "Icelandair — connecting the Atlantic via its Reykjavík hub, built around transit connections.",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🇮🇸 Iceland"
      },
      {
        "cls": "tag-gray",
        "label": "Independent"
      },
      {
        "cls": "tag-gray",
        "label": "FSC/LCC Hybrid"
      },
      {
        "cls": "tag-gold",
        "label": "North Atlantic Hub"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "~50",
        "label": "Fleet Size"
      },
      {
        "val": "50+",
        "label": "Destinations"
      }
    ],
    "overview": [
      "Icelandair is a carrier that has carved out a distinctive position on transatlantic routes between North America and Europe, using Reykjavík–Keflavík as its hub. Its product is uniquely designed around <strong>free stopovers in Iceland</strong> as a connecting point. Its fleet is centered on the B737 MAX. The airline is independent (not a member of any alliance). Iceland has a high cost of living and high income tax, but its rich natural environment makes it a popular place to live."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Reykjavík (Iceland)"
      },
      {
        "k": "Hub",
        "v": "Keflavík International Airport (KEF)"
      },
      {
        "k": "Alliance",
        "v": "None (independent)"
      },
      {
        "k": "Founded",
        "v": "1937"
      },
      {
        "k": "Fleet Size",
        "v": "~50 aircraft"
      },
      {
        "k": "Income Tax",
        "v": "Yes (up to 46.3%)"
      }
    ],
    "salaryNote": "Pilot pay is denominated in USD/EUR (with ISK conversion applied) and follows a seniority-based scale. Iceland's income tax reaches up to 46.3%, and the cost of living is high, so factor this into any comparison.",
    "ops": {
      "routes": "Transatlantic routes are the core of the network, connecting North America (New York, Boston, Chicago, etc.) and Europe (London, Copenhagen, Frankfurt, etc.) from the Keflavík hub.",
      "fleet": "Boeing 737 MAX 8/9 and B767-300ER. About 50 aircraft."
    },
    "training": [
      {
        "title": "Type Rating Training (EASA-approved; note cost-sharing)",
        "body": "Conducted at an EASA-approved ATO. At LCCs, some contract arrangements require the pilot to bear part or all of the type-rating training cost. Confirm the details."
      },
      {
        "title": "LIFUS",
        "body": "After obtaining the type rating, line training is flown with an instructor captain on board. LCCs with many short-haul routes let you build up legs relatively quickly."
      },
      {
        "title": "Recurrent Checks (OPC/LPC)",
        "body": "Checks are conducted one to two times a year in line with EASA standards. LCCs are held to equivalent safety standards."
      },
      {
        "title": "Upgrade",
        "body": "FO-to-Captain upgrade typically requires a minimum of 4,000–5,000 flight hours or more as a guideline. LCCs can offer more frequent upgrade opportunities."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Staff Travel Discounts",
        "body": "Discounted or free travel on the airline's own flights. Often extends to group and partner carriers."
      },
      {
        "icon": "🏥",
        "title": "Health Insurance",
        "body": "Basic health insurance (in Europe, combined with EHIC / public healthcare systems)."
      },
      {
        "icon": "📈",
        "title": "Productivity Bonus",
        "body": "Duty pay or productivity bonuses, frequently linked to flight hours and number of legs."
      },
      {
        "icon": "📅",
        "title": "Paid Leave",
        "body": "A minimum of 20 days or more under EU directives, in compliance with each country's laws."
      },
      {
        "icon": "🏠",
        "title": "Base City Allowance",
        "body": "A duty allowance for working out of a chosen base city (London, Madrid, etc.)."
      },
      {
        "icon": "🌋",
        "title": "Iceland's Natural Environment",
        "body": "One of the world's premier lifestyle environments, surrounded by the northern lights, hot springs, and vast nature. The variety of flying during the tourist season is another draw."
      }
    ],
    "hiringStatus": "Recruiting on an ongoing basis. Open to holders of an EASA ATPL.",
    "hiringColor": "#34d399",
    "jobs": [
      {
        "title": "Captain / First Officer (Ongoing Recruitment)",
        "sub": "Flying transatlantic routes. Keflavík-based.",
        "status": "Recruiting",
        "statusTag": "green",
        "details": [
          {
            "k": "License",
            "v": "EASA ATPL (Samgöngustofa-approved)"
          },
          {
            "k": "English",
            "v": "ICAO Level 4 or above"
          },
          {
            "k": "Min. Flight Hours",
            "v": "Captain 4,500 hrs or more (guideline)"
          },
          {
            "k": "Type Rating",
            "v": "B737 MAX / B767 preferred"
          }
        ],
        "note": "English is widely spoken (as across the Nordic region), making it an easy environment for Japanese pilots to live in. Getting used to the winter darkness takes some adjustment."
      }
    ],
    "recruitUrl": "https://www.icelandair.com/company/careers/"
  },
  {
    "file": "ita-airways.html",
    "code": "AZ",
    "color": "#008751",
    "nameEn": "ITA Airways",
    "subtitle": "ITA Airways — Italy's state-owned flag carrier and successor to the former Alitalia.",
    "tags": [
      {
        "cls": "tag-green",
        "label": "🇮🇹 Italy"
      },
      {
        "cls": "tag-blue",
        "label": "SkyTeam (Associate)"
      },
      {
        "cls": "tag-gray",
        "label": "FSC"
      },
      {
        "cls": "tag-orange",
        "label": "Restructuring"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "~80",
        "label": "Fleet Size"
      },
      {
        "val": "75+",
        "label": "Destinations"
      }
    ],
    "overview": [
      "ITA Airways is Italy's state-owned flag carrier, established in 2021 as the successor to Alitalia, which had collapsed into bankruptcy. From its hub at Rome–Fiumicino, it serves Europe, North America, Asia, and Africa. Negotiations for its sale to the <strong>Lufthansa Group</strong> were concluded in 2024, with full subsidiary ownership planned. It is an associate member of SkyTeam, and its main fleet is built around the A320 family, A330, and A350."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Rome, Italy"
      },
      {
        "k": "Hub",
        "v": "Fiumicino Airport (FCO)"
      },
      {
        "k": "Alliance",
        "v": "SkyTeam (Associate)"
      },
      {
        "k": "Founded",
        "v": "2021 (ITA Airways)"
      },
      {
        "k": "Fleet Size",
        "v": "~80 aircraft"
      },
      {
        "k": "Income Tax",
        "v": "Yes (up to 43%)"
      }
    ],
    "salaryNote": "Pilot pay is denominated in EUR and quoted pre-tax, on a seniority-based pay system; a EUR/JPY rate of 163 is used for conversion. Italian income tax reaches up to 43%. Compensation terms may change following ITA's integration into the Lufthansa Group.",
    "ops": {
      "routes": "From its Rome hub, ITA Airways serves North America (New York, Miami, etc.), Asia (Tokyo, Shanghai, Bangkok, etc.), Africa, and destinations across Europe as well as domestic routes.",
      "fleet": "Airbus A350-900, A330-200/900neo, A321neo, A320neo, and A319. Approximately 80 aircraft."
    },
    "training": [
      {
        "title": "Type Rating (EASA-approved ATO)",
        "body": "Type rating obtained at an EASA-certified Approved Training Organisation (ATO). Ground school → simulator (including MCC) → LIFUS."
      },
      {
        "title": "LIFUS (Line Training)",
        "body": "After obtaining the type rating, Line Flying Under Supervision is conducted with an instructor captain on board. Typically around 50–80 legs (compliant with EASA FCL.060)."
      },
      {
        "title": "Recurrent Checks (OPC/LPC)",
        "body": "Proficiency Checks (PC) held once or twice a year, to EASA FCL.625/735 standards. Overseen by the respective national CAAs (CAA UK, DGAC, LBA, etc.)."
      },
      {
        "title": "Captain Upgrade & Additional Ratings",
        "body": "Captain training follows a period as SFO / Senior F/O. Additional qualifications such as LVP (Low Visibility Procedures), PBN, ETOPS, and RVSM are also obtained."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Staff Travel",
        "body": "Heavily discounted or free flight tickets for pilots and their families. Also usable on alliance partner carriers."
      },
      {
        "icon": "🏥",
        "title": "Medical Insurance",
        "body": "High-standard European medical insurance. Loss-of-licence insurance is also common."
      },
      {
        "icon": "💰",
        "title": "Bonus",
        "body": "Performance-linked bonuses (equivalent to 2–4 months' pay per year). In some cases tied to performance reviews."
      },
      {
        "icon": "📅",
        "title": "Paid Leave",
        "body": "25–35 days per year. Generous leave under European labour law (EU directives)."
      },
      {
        "icon": "🏦",
        "title": "Retirement & Corporate Pension",
        "body": "Defined-benefit or defined-contribution corporate pension (DBP/DCP). In Europe this sits alongside the public pension in a two-tier structure."
      },
      {
        "icon": "🌐",
        "title": "Layover Allowance",
        "body": "Accommodation and per-diem paid during overseas stays. High-cost-area allowances tend to be higher in major European cities."
      }
    ],
    "hiringStatus": "Hiring — note that terms may change after integration into the Lufthansa Group.",
    "hiringColor": "#f5c842",
    "jobs": [
      {
        "title": "Captain & First Officer (Regular Intake)",
        "sub": "International flights. Based at Rome FCO.",
        "status": "Hiring",
        "statusTag": "blue",
        "details": [
          {
            "k": "Required License",
            "v": "EASA ATPL (ENAC-certified)"
          },
          {
            "k": "English",
            "v": "ICAO Level 4 or above"
          },
          {
            "k": "Minimum Flight Hours",
            "v": "Captain 5,000h+"
          },
          {
            "k": "Italian",
            "v": "Conversational level recommended"
          }
        ],
        "note": "Integration into the Lufthansa Group is underway across 2024–2025; terms may change."
      }
    ],
    "recruitUrl": "https://www.ita-airways.com/en_en/ita-airways-careers.html"
  },
  {
    "file": "lot.html",
    "code": "LO",
    "color": "#003399",
    "nameEn": "LOT Polish Airlines",
    "subtitle": "LOT Polish Airlines — Poland's state-owned flag carrier · Star Alliance member",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🇵🇱 Poland"
      },
      {
        "cls": "tag-blue",
        "label": "Star Alliance"
      },
      {
        "cls": "tag-gray",
        "label": "FSC"
      },
      {
        "cls": "tag-orange",
        "label": "Central European Hub"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "~80",
        "label": "Fleet Size"
      },
      {
        "val": "130+",
        "label": "Destinations"
      }
    ],
    "overview": [
      "LOT Polish Airlines is Poland's state-owned flag carrier, <strong>founded in 1929</strong>. From its Warsaw hub it operates services across Europe, North America, Asia, and the Middle East, and is a member of <strong>Star Alliance</strong>. Poland has a relatively low cost of living within the EU, and pilot packages are commonly contracted in euros (EUR). The airline deploys the Boeing 787 as its primary long-haul aircraft, while the B737 and Dash 8 cover intra-European and domestic routes."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Warsaw, Poland"
      },
      {
        "k": "Hub",
        "v": "Warsaw Chopin Airport (WAW)"
      },
      {
        "k": "Alliance",
        "v": "Star Alliance"
      },
      {
        "k": "Founded",
        "v": "1929"
      },
      {
        "k": "Fleet Size",
        "v": "~80 aircraft"
      },
      {
        "k": "Income Tax",
        "v": "Yes (up to 32%)"
      }
    ],
    "salaryNote": "Pilot compensation is contracted and quoted in euros (EUR), pre-tax, under a seniority-based structure. Poland's income tax tops out at 32%, which is low by European standards, and Warsaw's cost of living is lower than in major EU cities — giving euro-denominated income high real purchasing power. Yen equivalents on this site assume a EUR/JPY rate of 163.",
    "ops": {
      "routes": "From its Warsaw hub, LOT serves North America (New York, Chicago, Los Angeles, etc.), Asia (Tokyo, Seoul, Beijing, etc.), all of Europe, the Middle East, and domestic routes.",
      "fleet": "Boeing 787-8/9, B737 MAX 8, B737-800, Embraer E170/175/195. Approximately 80 aircraft."
    },
    "training": [
      {
        "title": "Type Rating (EASA-approved ATO)",
        "body": "Type rating is obtained at an EASA-certified Approved Training Organisation (ATO). The path runs from ground school → simulator (including MCC) → LIFUS."
      },
      {
        "title": "LIFUS (Line Training)",
        "body": "After the type rating, pilots fly Line Flying Under Supervision with an instructor captain aboard — typically around 50-80 legs (per EASA FCL.060)."
      },
      {
        "title": "Recurrent Checks (OPC/LPC)",
        "body": "Proficiency Checks (PC) are conducted one to two times per year, based on EASA FCL.625/735 standards and overseen by the relevant national CAAs (CAA UK, DGAC, LBA, etc.)."
      },
      {
        "title": "Captain Upgrade & Additional Ratings",
        "body": "After a period as an SFO/Senior F/O, pilots undergo captain training. Additional qualifications such as LVP (Low Visibility Procedures), PBN, ETOPS, and RVSM are also obtained."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Staff Travel",
        "body": "Heavily discounted or free tickets for pilots and their families, also usable on alliance partner airlines."
      },
      {
        "icon": "🏥",
        "title": "Medical Insurance",
        "body": "High-standard European medical insurance. Loss-of-license insurance is also common."
      },
      {
        "icon": "💰",
        "title": "Bonus",
        "body": "Performance-linked bonuses (equivalent to 2-4 months per year), in some cases tied to individual performance reviews."
      },
      {
        "icon": "📅",
        "title": "Paid Leave",
        "body": "25-35 days per year — a generous leave system under European labor law (EU directives)."
      },
      {
        "icon": "🏦",
        "title": "Retirement & Corporate Pension",
        "body": "Defined-benefit or defined-contribution corporate pension plans (DBP/DCP), layered on top of the state pension in the typical European dual structure."
      },
      {
        "icon": "🌐",
        "title": "Layover Allowance",
        "body": "Accommodation and per diem paid for overseas stays, with higher high-cost-area allowances for major European cities."
      }
    ],
    "hiringStatus": "Actively recruiting on an ongoing basis. Open to EASA ATPL holders; B787 type rating holders preferred.",
    "hiringColor": "#34d399",
    "jobs": [
      {
        "title": "Captain / First Officer (Ongoing Recruitment)",
        "sub": "International operations. Warsaw-based.",
        "status": "Recruiting",
        "statusTag": "green",
        "details": [
          {
            "k": "License",
            "v": "EASA ATPL (ULC-certified)"
          },
          {
            "k": "English",
            "v": "ICAO Level 4 or above"
          },
          {
            "k": "Min. Flight Hours",
            "v": "Captain: 5,000h+"
          },
          {
            "k": "Type Rating",
            "v": "B787/B737 preferred"
          }
        ],
        "note": "Warsaw has a low cost of living for Europe, giving euro-denominated income high real purchasing power."
      }
    ],
    "recruitUrl": "https://careers.lot.com"
  },
  {
    "file": "norwegian.html",
    "code": "DY",
    "color": "#D41819",
    "nameEn": "Norwegian Air Shuttle (Norwegian)",
    "subtitle": "Norwegian Air Shuttle — a major European LCC and a pioneer of low-cost long-haul routes.",
    "tags": [
      {
        "cls": "tag-red",
        "label": "🇳🇴 Norway"
      },
      {
        "cls": "tag-orange",
        "label": "LCC"
      },
      {
        "cls": "tag-gray",
        "label": "Independent"
      },
      {
        "cls": "tag-blue",
        "label": "Europe"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "~80",
        "label": "Fleet Size"
      },
      {
        "val": "150+",
        "label": "Cities Served (Europe)"
      }
    ],
    "overview": [
      "Norwegian Air Shuttle is Scandinavia's largest LCC, and it has operated across all of Europe as well as North American routes on low-cost fares. After going through a financial restructuring during the COVID crisis of 2020–2021, it downsized and relaunched. It is now redeploying primarily on intra-European routes with the Boeing 737 as its mainstay. Norway has high income tax (up to <strong>47.4%</strong>), but pilots benefit from the generous Nordic social welfare system."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Fornebu, Norway"
      },
      {
        "k": "Hub",
        "v": "Oslo Gardermoen Airport (OSL)"
      },
      {
        "k": "Alliance",
        "v": "None (independent)"
      },
      {
        "k": "Founded",
        "v": "1993"
      },
      {
        "k": "Fleet Size",
        "v": "Approx. 80 aircraft"
      },
      {
        "k": "Income Tax",
        "v": "Yes (up to 47.4%)"
      }
    ],
    "salaryNote": "Compensation is denominated in NOK/EUR; yen figures use EUR/JPY = 163 (NOK/JPY conversion included). Norway levies income tax of up to 47.4%. Pay follows a seniority-based system, and terms may have shifted since the 2022 restructuring, so they should be confirmed.",
    "ops": {
      "routes": "From its Oslo hub, Norwegian serves all of Europe (Spain, Italy, Greece, and more) as well as North Africa and the Canary Islands. Its long-haul (North American) routes were discontinued during the 2022 restructuring.",
      "fleet": "Boeing 737 MAX 8 and Boeing 737-800; approximately 80 aircraft."
    },
    "training": [
      {
        "title": "Type Rating (EASA-approved — note cost responsibility)",
        "body": "Conducted at an EASA-approved ATO. At LCCs, some contract arrangements require the pilot to bear part or all of the type-rating cost, so this should be confirmed."
      },
      {
        "title": "LIFUS",
        "body": "After obtaining the type rating, line training is flown with an instructor captain on board. At an LCC with many short-haul routes, pilots can accumulate legs relatively quickly."
      },
      {
        "title": "Recurrent Checks (OPC/LPC)",
        "body": "Checks are carried out one to two times per year in accordance with EASA standards. LCCs apply the same safety standards."
      },
      {
        "title": "Upgrade",
        "body": "An FO-to-Captain upgrade typically requires a minimum of 4,000–5,000+ flight hours as a guideline. LCCs can offer more frequent upgrade opportunities."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Staff Travel Discounts",
        "body": "Discounted or complimentary travel on the airline's own flights. Often extended to group and partner carriers."
      },
      {
        "icon": "🏥",
        "title": "Health Insurance",
        "body": "Basic health insurance (in Europe, combined with the EHIC and public healthcare systems)."
      },
      {
        "icon": "📈",
        "title": "Productivity Bonus",
        "body": "Duty pay or a productivity bonus, most often linked to flight hours and number of legs."
      },
      {
        "icon": "📅",
        "title": "Paid Leave",
        "body": "A minimum of 20 days or more under EU directives, in compliance with each country's laws."
      },
      {
        "icon": "🏠",
        "title": "Base City Allowance",
        "body": "A duty allowance for working at a chosen base city (London, Madrid, and others)."
      }
    ],
    "hiringStatus": "Hiring (post-restructuring). Open to holders of an EASA ATPL.",
    "hiringColor": "#f5c842",
    "jobs": [
      {
        "title": "Captain / First Officer (Regular Recruitment)",
        "sub": "European route flying. Primarily Oslo-based.",
        "status": "Hiring",
        "statusTag": "blue",
        "details": [
          {
            "k": "License",
            "v": "EASA ATPL (Luftfartstilsynet-approved)"
          },
          {
            "k": "English",
            "v": "ICAO Level 4 or above"
          },
          {
            "k": "Min. Flight Hours",
            "v": "Captain 4,000h+ (guideline)"
          },
          {
            "k": "Type Rating",
            "v": "B737 MAX preferred"
          }
        ],
        "note": "Following the 2022 restructuring, the airline now operates under a new business model focused on intra-European routes."
      }
    ],
    "recruitUrl": "https://www.norwegian.com/en/about/careers/"
  },
  {
    "file": "sas.html",
    "code": "SK",
    "color": "#00445B",
    "nameEn": "SAS Scandinavian Airlines",
    "subtitle": "The jointly owned airline of the three Scandinavian nations.",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🇸🇪🇩🇰🇳🇴 Nordic 3 Countries"
      },
      {
        "cls": "tag-blue",
        "label": "Star Alliance"
      },
      {
        "cls": "tag-gray",
        "label": "Full-Service Carrier (FSC)"
      },
      {
        "cls": "tag-orange",
        "label": "Under Restructuring"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "~130",
        "label": "Fleet Size"
      },
      {
        "val": "130+",
        "label": "Destinations"
      }
    ],
    "overview": [
      "SAS Scandinavian Airlines is the flag carrier jointly funded by three countries — Sweden, Denmark, and Norway. From its hubs in Copenhagen, Stockholm, and Oslo, it serves all of Europe as well as North America and Asia, and it is a member of Star Alliance. In 2022 the airline filed for protection under U.S. Chapter 11 bankruptcy law, and after going through restructuring proceedings it relaunched in 2024. It is currently being rebuilt under the ownership of Aqua Partners (Castard and Apollo)."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Copenhagen, Denmark"
      },
      {
        "k": "Hub",
        "v": "CPH / ARN / OSL"
      },
      {
        "k": "Alliance",
        "v": "Star Alliance"
      },
      {
        "k": "Founded",
        "v": "1946"
      },
      {
        "k": "Fleet Size",
        "v": "~130 aircraft"
      },
      {
        "k": "Income Tax",
        "v": "Yes (top marginal rate 55–56%)"
      }
    ],
    "salaryNote": "Pay is denominated in EUR (including portions of SEK/DKK/NOK converted into EUR) and shown at an assumed rate of EUR/JPY = 163. Nordic income tax is among the highest in the world (top marginal rate of 55–56%), but this is offset by an extensive high-welfare social system. Pay progresses on a seniority-based system. All figures are reference values based on public data and industry benchmarks; conditions following the 2024 restructuring should be verified with the airline's official recruitment information.",
    "ops": {
      "routes": "From its hubs in Copenhagen, Stockholm, and Oslo, SAS serves North America (New York, Chicago, etc.), Asia (Tokyo, Shanghai, Bangkok, etc.), and all of Europe.",
      "fleet": "Airbus A350-900, A330-300, A321LR/neo, A320neo. Approximately 130 aircraft (fleet under restructuring)."
    },
    "training": [
      {
        "title": "Type Rating (EASA-approved ATO)",
        "body": "Type rating obtained at an EASA-certified Approved Training Organisation (ATO). Ground school → simulator (including MCC) → LIFUS."
      },
      {
        "title": "LIFUS (Line Training)",
        "body": "After obtaining the type rating, Line Flying Under Supervision is conducted with an instructor captain on board. Typically around 50–80 legs (in accordance with EASA FCL.060)."
      },
      {
        "title": "Recurrent Checks (OPC/LPC)",
        "body": "Proficiency Checks (PC) once or twice a year, to EASA FCL.625/735 standards. Supervised by the respective national CAAs (CAA UK / DGAC / LBA, etc.)."
      },
      {
        "title": "Captain Upgrade & Additional Ratings",
        "body": "After a period as SFO / Senior F/O, pilots undergo captain training. Additional qualifications such as LVP (Low Visibility Procedures), PBN, ETOPS, and RVSM are also obtained."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Staff Travel",
        "body": "Heavily discounted or free tickets for the employee and family. Also usable on alliance partner carriers."
      },
      {
        "icon": "🏥",
        "title": "Health Insurance",
        "body": "High-standard European health insurance. Loss-of-license insurance is also common."
      },
      {
        "icon": "💰",
        "title": "Bonus",
        "body": "Performance-linked bonus (equivalent to 2–4 months' salary per year). In some cases tied to individual performance evaluations."
      },
      {
        "icon": "📅",
        "title": "Paid Leave",
        "body": "25–35 days per year. Generous leave provisions under European labor law (EU directives)."
      },
      {
        "icon": "🏦",
        "title": "Retirement / Corporate Pension",
        "body": "Defined-benefit or defined-contribution corporate pension (DBP/DCP). In Europe this operates as a dual structure alongside the state pension."
      },
      {
        "icon": "🌐",
        "title": "Layover Allowance",
        "body": "Accommodation and per diem paid for overseas stays. For major European cities, the high-cost-area allowance tends to be higher."
      },
      {
        "icon": "🌿",
        "title": "Nordic Welfare Model",
        "body": "Benefits from the three Nordic countries' comprehensive public healthcare, parental leave, and pension systems. Income tax is high, but social security is generous."
      }
    ],
    "hiringStatus": "Following the 2024 restructuring, hiring has resumed. Check the official website for the latest status.",
    "hiringColor": "#f5c842",
    "jobs": [
      {
        "title": "Captain / First Officer (Regular Intake)",
        "sub": "International operations. Copenhagen / Stockholm base.",
        "status": "Hiring (post-restructuring)",
        "statusTag": "blue",
        "details": [
          {
            "k": "License",
            "v": "EASA ATPL (recognized by national CAAs)"
          },
          {
            "k": "English",
            "v": "ICAO Level 4 or above"
          },
          {
            "k": "Min. Flight Hours",
            "v": "5,000h+ for Captain"
          },
          {
            "k": "Type Rating",
            "v": "A350 / A330 / A321 preferred"
          }
        ],
        "note": "Hiring resumed after the 2022–2024 restructuring process. Terms and conditions may fluctuate depending on union negotiations."
      }
    ],
    "recruitUrl": "https://www.flysas.com/en/careers/"
  },
  {
    "file": "tap.html",
    "code": "TP",
    "color": "#C0272D",
    "nameEn": "TAP Air Portugal",
    "subtitle": "Portugal's flag carrier, with a strong presence on transatlantic routes.",
    "tags": [
      {
        "cls": "tag-red",
        "label": "🇵🇹 Portugal"
      },
      {
        "cls": "tag-blue",
        "label": "Star Alliance"
      },
      {
        "cls": "tag-gray",
        "label": "FSC"
      },
      {
        "cls": "tag-gold",
        "label": "Transatlantic Routes"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "~110",
        "label": "Fleet Size"
      },
      {
        "val": "100+",
        "label": "Destinations"
      }
    ],
    "overview": [
      "TAP Air Portugal is <strong>Portugal's flag carrier</strong>, founded in 1945. From its hubs at Lisbon and Porto, it flies to Brazil (Rio, São Paulo, Fortaleza and more), North America, Africa and across all of Europe. It is a member of <strong>Star Alliance</strong>. Having gone through a nationalization-and-privatization process between 2021 and 2024, the airline is currently being restructured. The A320 family and the A330 form the backbone of its fleet, and it is especially strong across its Portuguese-speaking network in Brazil and Africa."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Lisbon, Portugal"
      },
      {
        "k": "Hub",
        "v": "Lisbon Airport (LIS)"
      },
      {
        "k": "Alliance",
        "v": "Star Alliance"
      },
      {
        "k": "Founded",
        "v": "1945"
      },
      {
        "k": "Fleet Size",
        "v": "~110 aircraft"
      },
      {
        "k": "Income Tax",
        "v": "Yes (top rate 48%)"
      }
    ],
    "salaryNote": "Salaries are denominated in EUR and quoted pre-tax, with pay progressing on a seniority-based system. Portugal's income tax reaches a top rate of 48%. Yen conversions use an EUR/JPY rate of 163. Lisbon is a popular place to live, offering a relatively low cost of living by European standards.",
    "ops": {
      "routes": "From its Lisbon hub, TAP serves Brazil (São Paulo, Rio, Fortaleza and more than 10 cities), North America (New York, Boston, etc.), Africa (Luanda, Maputo, etc.) and all of Europe.",
      "fleet": "Airbus A330-200/300/900neo, A321LR/XLR, A320neo and A319. Around 110 aircraft."
    },
    "training": [
      {
        "title": "Type-Rating Training (EASA-Approved ATO)",
        "body": "Type ratings are earned at an EASA-certified Approved Training Organisation (ATO). The course runs from ground-school theory to the simulator (including MCC) and then LIFUS."
      },
      {
        "title": "LIFUS (Line Training)",
        "body": "After obtaining the type rating, pilots fly Line Flying Under Supervision alongside an instructor captain — typically around 50 to 80 legs (in line with EASA FCL.060)."
      },
      {
        "title": "Recurrent Checks (OPC/LPC)",
        "body": "Proficiency Checks (PC) are conducted once or twice a year to EASA FCL.625/735 standards, supervised by the national civil aviation authorities (CAA UK, DGAC, LBA, etc.)."
      },
      {
        "title": "Captain Upgrade & Additional Ratings",
        "body": "After a period as SFO/Senior F/O, pilots move on to captain training. Additional qualifications such as LVP (Low Visibility Procedures), PBN, ETOPS and RVSM are also obtained."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Staff Travel",
        "body": "Heavily discounted or free air tickets for pilots and their families, usable on alliance partner carriers as well."
      },
      {
        "icon": "🏥",
        "title": "Medical Insurance",
        "body": "High-standard European medical insurance. Loss-of-license insurance is also common."
      },
      {
        "icon": "💰",
        "title": "Bonus",
        "body": "Performance-linked bonuses worth two to four months' pay a year, in some cases tied to individual performance reviews."
      },
      {
        "icon": "📅",
        "title": "Paid Leave",
        "body": "25 to 35 days a year — a generous leave system underpinned by European labor law (EU directives)."
      },
      {
        "icon": "🏦",
        "title": "Retirement & Corporate Pension",
        "body": "Defined-benefit or defined-contribution corporate pensions (DBP/DCP), layered on top of the public pension in the typical European two-tier structure."
      },
      {
        "icon": "🌐",
        "title": "Layover Allowance",
        "body": "Accommodation and per-diem paid for overseas layovers, with higher high-cost-area allowances for major European cities."
      }
    ],
    "hiringStatus": "Hiring (following the restructuring process). Open to EASA ATPL holders.",
    "hiringColor": "#f5c842",
    "jobs": [
      {
        "title": "Captain & First Officer (Regular Intake)",
        "sub": "International operations. Lisbon-based.",
        "status": "Hiring",
        "statusTag": "blue",
        "details": [
          {
            "k": "License",
            "v": "EASA ATPL (ANAC-approved)"
          },
          {
            "k": "English",
            "v": "ICAO Level 4 or above"
          },
          {
            "k": "Min. Flight Hours",
            "v": "Captain: 5,000h+"
          },
          {
            "k": "Portuguese",
            "v": "Not required (English-language workplace)"
          }
        ],
        "note": "Under the NHR visa scheme, Portugal offers a tax regime favorable to foreign nationals (please verify current details)."
      }
    ],
    "recruitUrl": "https://www.tapportugal.com/en/open-positions"
  },
  {
    "file": "vueling.html",
    "code": "VY",
    "color": "#FFCC00",
    "nameEn": "Vueling Airlines",
    "subtitle": "Vueling Airlines — Spain's largest LCC, part of the IAG Group",
    "tags": [
      {
        "cls": "tag-gold",
        "label": "🇪🇸 Spain"
      },
      {
        "cls": "tag-orange",
        "label": "LCC"
      },
      {
        "cls": "tag-blue",
        "label": "IAG Group"
      },
      {
        "cls": "tag-blue",
        "label": "Europe"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "~130",
        "label": "Fleet Size"
      },
      {
        "val": "150+",
        "label": "Destinations"
      }
    ],
    "overview": [
      "Vueling Airlines is Spain's largest LCC and part of the IAG Group (the same group as British Airways and Iberia). Using Barcelona–El Prat Airport as its main base, it serves all of Europe as well as North Africa and the Middle East. Its fleet is kept simple and standardized on the A320 family. Based in Spain, it has a strong Mediterranean network, and Barcelona—one of Europe's leading tourism and business cities—offers an excellent living environment."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Barcelona, Spain"
      },
      {
        "k": "Hub",
        "v": "Barcelona–El Prat Airport (BCN)"
      },
      {
        "k": "Alliance",
        "v": "IAG Group (Oneworld-affiliated)"
      },
      {
        "k": "Founded",
        "v": "2004"
      },
      {
        "k": "Fleet Size",
        "v": "~130 aircraft"
      },
      {
        "k": "Income Tax",
        "v": "Yes (up to 47%)"
      }
    ],
    "salaryNote": "Pay is denominated in EUR and quoted pre-tax, with conversions based on EUR/JPY = 163. Spanish income tax reaches up to 47%. Compensation follows a seniority-based system, with duty pay / productivity bonuses tied to flight hours and legs. The cost of living in Barcelona is on the higher side, but among European LCCs the employment environment is relatively stable.",
    "ops": {
      "routes": "From its Barcelona hub, Vueling flies across all of Europe (France, Italy, Germany, the UK and more), North Africa (Morocco, Tunisia, etc.) and the Middle East (Abu Dhabi, etc.). It also covers domestic routes.",
      "fleet": "Airbus A321neo, A320neo, A320ceo and A319. Around 130 aircraft."
    },
    "training": [
      {
        "title": "Type Rating (EASA-approved — note on cost burden)",
        "body": "Conducted at an EASA-certified ATO. At LCCs, some contract arrangements require the pilot to cover part or all of the type-rating cost, so confirm the terms in advance."
      },
      {
        "title": "LIFUS",
        "body": "After obtaining the type rating, line training is flown with an instructor captain on board. At an LCC with many short-haul routes, pilots can build up their leg count relatively quickly."
      },
      {
        "title": "Recurrent Checks (OPC/LPC)",
        "body": "One to two checks per year based on EASA standards. LCCs are held to the same safety standards."
      },
      {
        "title": "Upgrade",
        "body": "FO-to-Captain upgrade typically requires a minimum of around 4,000–5,000 flight hours. LCCs can also offer more frequent upgrade opportunities."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Staff Discounts",
        "body": "Discounted or complimentary travel on Vueling flights, frequently extended to group and partner airlines."
      },
      {
        "icon": "🏥",
        "title": "Medical Insurance",
        "body": "Basic medical insurance (in Europe, combined with the EHIC / public healthcare systems)."
      },
      {
        "icon": "📈",
        "title": "Productivity Bonus",
        "body": "Duty pay or a productivity bonus, usually tied to flight hours and number of legs."
      },
      {
        "icon": "📅",
        "title": "Paid Leave",
        "body": "At least 20 days based on EU directives, in accordance with each country's laws."
      },
      {
        "icon": "🏠",
        "title": "Base City Allowance",
        "body": "An allowance for working at your chosen base city (London, Madrid, etc.)."
      },
      {
        "icon": "🏖️",
        "title": "Barcelona Living Environment",
        "body": "A Mediterranean climate, beaches and cultural richness—living based in Barcelona, one of Europe's most popular places to live."
      }
    ],
    "hiringStatus": "Recruiting on an ongoing basis. Open to holders of an EASA ATPL; A320 type-rating holders preferred.",
    "hiringColor": "#34d399",
    "jobs": [
      {
        "title": "Captain / First Officer (Ongoing Recruitment)",
        "sub": "European routes. Barcelona / Madrid base.",
        "status": "Recruiting",
        "statusTag": "green",
        "details": [
          {
            "k": "License",
            "v": "EASA ATPL (AESA-approved)"
          },
          {
            "k": "English",
            "v": "ICAO Level 4 or above"
          },
          {
            "k": "Min. Flight Hours",
            "v": "Captain: 4,000+ hrs (guideline)"
          },
          {
            "k": "Type Rating",
            "v": "A320 family preferred"
          }
        ],
        "note": "There are opportunities to transfer within the IAG Group (BA, Iberia, etc.). Speaking Spanish makes it easier to settle into the work environment."
      }
    ],
    "recruitUrl": "https://jobs.vueling.com"
  },
  {
    "file": "wizz-air.html",
    "code": "W6",
    "color": "#c5007c",
    "nameEn": "Wizz Air UK",
    "subtitle": "Wizz Air UK — one of Europe's largest ultra-low-cost carriers — an Airbus A320-family-only operator.",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🇬🇧 United Kingdom"
      },
      {
        "cls": "tag-orange",
        "label": "ULCC"
      },
      {
        "cls": "tag-blue",
        "label": "A320/A321"
      },
      {
        "cls": "tag-gray",
        "label": "European routes"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "250+",
        "label": "A320 family"
      },
      {
        "val": "3.5–5 yrs",
        "label": "FO→Captain upgrade"
      }
    ],
    "overview": [
      "Wizz Air UK is the British subsidiary of Wizz Air, the Hungarian-based ultra-low-cost carrier. It holds a UK Air Operator's Certificate (AOC) and operates to cities across Europe, primarily from bases such as London Gatwick. Operating only the Airbus A320/A321 family, it runs highly efficient operations and is one of Europe's largest ULCCs (Ultra Low Cost Carriers). In line with its aggressive fleet expansion, it recruits Captains and First Officers on a regular basis."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "London (United Kingdom)"
      },
      {
        "k": "Parent Company",
        "v": "Wizz Air Holdings (Hungary)"
      },
      {
        "k": "Hub",
        "v": "Gatwick Airport & Luton Airport"
      },
      {
        "k": "Fleet",
        "v": "Airbus A320/A321 only"
      },
      {
        "k": "Routes",
        "v": "Europe-focused (200+ routes)"
      },
      {
        "k": "Income Tax",
        "v": "Yes (UK, up to 45%)"
      }
    ],
    "salaryNote": "Figures are converted at GBP/JPY = 190 (March 2026). Income tax in the UK is high (up to 45%), so take-home pay is roughly 50–60% of gross. Take care when comparing directly with Middle Eastern carriers (tax-free). \"Duty Pay\" — a per-flight add-on characteristic of European ULCCs — has a large impact on total annual earnings.",
    "ops": {
      "routes": "Across the UK and Europe (200+ routes). Operating from its main bases at Gatwick, Luton and Birmingham, it serves numerous destinations in Eastern and Southern Europe, with routes to the Middle East and Africa also expanding.",
      "fleet": "More than 250 Airbus A320/A321 aircraft (including neo). The Wizz Air Group as a whole operates a large fleet of over 750 aircraft."
    },
    "training": [
      {
        "title": "A320 Type Rating",
        "body": "Type Rating training for applicants without the rating can be provided at the Wizz Air Pilot Academy (costs to be confirmed). Those who already hold the type rating undergo differences training only."
      },
      {
        "title": "Line Training (LIFUS)",
        "body": "After type training, qualification is completed through Line Flying Under Supervision (LIFUS), typically around 75 flights."
      },
      {
        "title": "Captain Upgrade",
        "body": "FO-to-Captain upgrade takes an average of 3.5–5 years. A minimum of 3,000 factored hours plus 1,000 hours PIC (A320) is required — one of the fastest timelines among European ULCCs."
      },
      {
        "title": "Recurrent Checks",
        "body": "OPC (Operator Proficiency Check) and LPC (License Proficiency Check) are conducted twice a year, in compliance with EASA requirements."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Staff Discounts",
        "body": "Heavily discounted tickets for employees and their families, valid on all Wizz Air Group flights."
      },
      {
        "icon": "📈",
        "title": "Duty Pay",
        "body": "Additional pay per flight — a variable form of compensation that substantially increases total annual earnings."
      },
      {
        "icon": "🏥",
        "title": "Medical Insurance",
        "body": "In addition to the UK's National Health Service (NHS), a private medical insurance option is available."
      },
      {
        "icon": "📅",
        "title": "Paid Leave",
        "body": "Statutory European leave (a minimum of 28 days) is guaranteed."
      },
      {
        "icon": "🎓",
        "title": "Training Cost Support",
        "body": "Depending on circumstances, support toward type rating training costs may be available (details to be confirmed at hiring)."
      }
    ],
    "hiringStatus": "Hiring (as of March 2026 — confirm latest)",
    "hiringColor": "#34d399",
    "jobs": [
      {
        "title": "Captain — Airbus A320/A321",
        "sub": "Direct Entry Captain",
        "status": "Open (confirm)",
        "statusTag": "blue",
        "details": [
          {
            "k": "Flight hours",
            "v": "1,500+ hours on large jets (over 50 t)"
          },
          {
            "k": "PIC experience",
            "v": "1,000+ hours on type"
          },
          {
            "k": "License",
            "v": "Valid EASA ATPL"
          }
        ],
        "note": "Deadline: March 25, 2026 (confirm latest)"
      },
      {
        "title": "First Officer — Airbus A320/A321",
        "sub": "Open to applicants with or without an A320 type rating",
        "status": "Open (confirm)",
        "statusTag": "blue",
        "details": [
          {
            "k": "Flight hours",
            "v": "500+ hours ME/IR multi-crew"
          },
          {
            "k": "License",
            "v": "ATPL theory passed (EASA)"
          },
          {
            "k": "Additional",
            "v": "Completed JOC/APS-MCC (jet)"
          }
        ],
        "note": ""
      }
    ],
    "recruitUrl": "https://www.latestpilotjobs.com/jobs/view/id/19249.html"
  },
  {
    "code": "AXC",
    "color": "#a78bfa",
    "file": "airx-charter.html",
    "nameEn": "AirX Charter Ltd",
    "subtitle": "AirX Charter Ltd — a Malta-based European private charter operator.",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🇪🇺 Europe (Malta)"
      },
      {
        "cls": "tag-gray",
        "label": "Charter"
      },
      {
        "cls": "tag-gold",
        "label": "Permanent employee"
      },
      {
        "cls": "tag-blue",
        "label": "EMB170/190"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "Malta",
        "label": "Headquarters"
      },
      {
        "val": "EMB170/190",
        "label": "Fleet"
      }
    ],
    "overview": [
      "AirX Charter Ltd is a Malta-based European private charter operator. It provides high-quality charter flights using the Embraer Lineage 1000 (based on the EMB170/190). The company plans to hire First Officers as permanent, full-time employees. This is an opportunity aimed at pilots who want to build a career in private aviation and charter operations."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Malta (EU)"
      },
      {
        "k": "Business type",
        "v": "Private charter"
      },
      {
        "k": "Fleet",
        "v": "Embraer Lineage 1000 (EMB170/190)"
      },
      {
        "k": "Employment",
        "v": "Full-time (permanent)"
      },
      {
        "k": "License requirement",
        "v": "EASA CPL/ATPL"
      },
      {
        "k": "Application deadline",
        "v": "April 11, 2026"
      }
    ],
    "salaryNote": "Detailed salary figures must be confirmed directly with AirX Charter. Pay follows the general European private-charter First Officer market for a permanent, full-time role and is denominated in euros (EUR).",
    "ops": {
      "routes": "Private charter flights across Europe. Clients are high-net-worth private individuals and corporate customers.",
      "fleet": "Embraer Lineage 1000 (a large private jet based on the EMB170/190)."
    },
    "training": [
      {
        "title": "EMB Type Rating Training",
        "body": "An EMB170/190 type rating is required. If you do not already hold the rating, training is required. Confirm the details with AirX."
      },
      {
        "title": "Charter Operations Training",
        "body": "Training that covers the operating procedures and customer-service practices specific to private charter flying."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Charter Experience",
        "body": "Gain private-flight experience serving high-net-worth clients."
      },
      {
        "icon": "🇪🇺",
        "title": "Living in Europe",
        "body": "The chance to live based in the EU (Malta)."
      },
      {
        "icon": "💼",
        "title": "Permanent Employment",
        "body": "Hired as a permanent employee rather than on a contract basis — stable, secure employment."
      }
    ],
    "hiringStatus": "Hiring (as of March 2026; application deadline April 11, 2026)",
    "hiringColor": "#34d399",
    "jobs": [
      {
        "title": "First Officer (F/O) — Embraer Lineage 1000 (EMB170/190)",
        "sub": "European private charter operations",
        "status": "Open",
        "statusTag": "green",
        "details": [
          {
            "k": "Required license",
            "v": "Valid EASA CPL/ATPL"
          },
          {
            "k": "Type rating",
            "v": "EMB170/190 type rating (preferred)"
          },
          {
            "k": "Employment",
            "v": "Full-time (permanent)"
          }
        ],
        "note": ""
      }
    ],
    "recruitUrl": "https://www.latestpilotjobs.com/jobs/view/id/19489.html"
  },
  {
    "file": "allegiant.html",
    "code": "G4",
    "color": "#F4A024",
    "nameEn": "Allegiant Air",
    "subtitle": "A ULCC specializing in small U.S. cities and dedicated to leisure routes.",
    "tags": [
      {
        "cls": "tag-gold",
        "label": "🇺🇸 United States"
      },
      {
        "cls": "tag-orange",
        "label": "ULCC"
      },
      {
        "cls": "tag-gray",
        "label": "Independent"
      },
      {
        "cls": "tag-blue",
        "label": "Leisure-focused"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "~130",
        "label": "Fleet Size"
      },
      {
        "val": "130+",
        "label": "Destinations"
      }
    ],
    "overview": [
      "Allegiant Air is a ULCC built on a <strong>distinctive business model</strong> that links small U.S. cities directly to leisure destinations such as Las Vegas and Florida at low fares. It specializes in point-to-point routes, and its efficient operation—no connections, with just two to three flights per week on each route—is a defining feature. The airline is transitioning to the A320 family while still operating some Boeing aircraft, and from its Las Vegas headquarters it continues to grow with a strong focus on operational efficiency."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Las Vegas, Nevada (USA)"
      },
      {
        "k": "Hub",
        "v": "Las Vegas (LAS) / San Francisco (SFO)"
      },
      {
        "k": "Alliance",
        "v": "None (independent)"
      },
      {
        "k": "Founded",
        "v": "1997"
      },
      {
        "k": "Fleet Size",
        "v": "~130 aircraft"
      },
      {
        "k": "Income Tax",
        "v": "Applicable (U.S. federal top rate 37%)"
      }
    ],
    "salaryNote": "Salaries are USD-denominated and quoted pre-tax; U.S. federal income tax applies (top rate 37%). Pay progresses on a seniority-based system. As a carrier focused purely on U.S. domestic routes, Allegiant offers a stable business model. JPY figures are converted at USD/JPY = 150.",
    "ops": {
      "routes": "Directly connects leisure destinations such as Las Vegas, Florida and Arizona with small cities across the U.S. (130+). Its hallmark is a nonstop, point-to-point model with no connections.",
      "fleet": "Airbus A320, A319, and (in part) Boeing 757-200. Around 130 aircraft."
    },
    "training": [
      {
        "title": "Type Rating Training (FAA-approved)",
        "body": "Type rating training at an FAA-certified ATO (Approved Training Organization). Conducted at Part 142 training centers (CAE, FlightSafety, etc.): ground school → simulator → LOFT."
      },
      {
        "title": "IOE (Initial Operating Experience)",
        "body": "After obtaining the type rating, Initial Operating Experience is flown under the supervision of a Check Airman (instructor captain). Typically around 25–50 legs."
      },
      {
        "title": "Recurrent Checks (PC/LOE)",
        "body": "Proficiency Check (PC) or Line Operational Evaluation (LOE) once or twice a year, compliant with FAA Part 121/135."
      },
      {
        "title": "Upgrade to Captain",
        "body": "Primarily seniority-based. Requires the necessary flight hours (typically 5,000–8,000h or more) and passing a check by a Check Airman. An R-ATP (1,500h) provision is available."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Staff Travel (Pass)",
        "body": "Pass travel for the employee and family. Free or heavily discounted boarding on Allegiant and partner airlines."
      },
      {
        "icon": "🏥",
        "title": "Medical, Dental & Vision Insurance",
        "body": "Comprehensive medical insurance (employee and family). Loss-of-license insurance is also common."
      },
      {
        "icon": "💰",
        "title": "401(k) Retirement Plan",
        "body": "Defined-contribution 401(k) with company matching. Matching of up to 5–16% is common."
      },
      {
        "icon": "📅",
        "title": "Paid Time Off",
        "body": "Roughly 15–30 days per year (increasing with seniority). Flexible leave options such as flip and skip are available."
      },
      {
        "icon": "💵",
        "title": "Per Diem",
        "body": "Daily allowance on flight days (around $2–4 per hour). Differs between domestic and international operations."
      },
      {
        "icon": "🌐",
        "title": "International Flying Allowance",
        "body": "Additional allowance and lodging expenses provided for crews operating international flights."
      }
    ],
    "hiringStatus": "Actively recruiting. Open to FAA ATP holders. U.S. work authorization required.",
    "hiringColor": "#34d399",
    "jobs": [
      {
        "title": "Captain / First Officer (Ongoing Recruitment)",
        "sub": "Domestic flying. Las Vegas base.",
        "status": "Recruiting",
        "statusTag": "green",
        "details": [
          {
            "k": "License",
            "v": "FAA ATP (1,500h)"
          },
          {
            "k": "English",
            "v": "Native or fluent"
          },
          {
            "k": "Minimum Flight Hours",
            "v": "To be confirmed"
          },
          {
            "k": "Work Eligibility",
            "v": "U.S. citizenship / permanent residency / work visa required"
          }
        ],
        "note": "With an operating style of just two to three flights per week, the schedule is considered relatively easy to balance with other work or family life."
      }
    ],
    "recruitUrl": "https://www.allegiantair.com/about-allegiant/careers"
  },
  {
    "file": "breeze-airways.html",
    "code": "MX",
    "color": "#00B4D8",
    "nameEn": "Breeze Airways",
    "subtitle": "Breeze Airways — a U.S. start-up carrier specializing in nonstop, point-to-point routes.",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🇺🇸 United States"
      },
      {
        "cls": "tag-orange",
        "label": "LCC"
      },
      {
        "cls": "tag-gray",
        "label": "Independent"
      },
      {
        "cls": "tag-green",
        "label": "Start-up"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "~70",
        "label": "Fleet Size"
      },
      {
        "val": "60+",
        "label": "Destinations"
      }
    ],
    "overview": [
      "Breeze Airways is a U.S. start-up carrier that launched service in 2021, founded by JetBlue founder David Neeleman. Built around the concept of <strong>directly connecting cities you previously couldn't fly between</strong>, it specializes in nonstop, point-to-point routes with no connections. Operating the Airbus A220 and Embraer E190/E195, it targets small- to mid-sized city pairs. The airline is growing rapidly and continues to hire pilots."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Salt Lake City, Utah (USA)"
      },
      {
        "k": "Hub",
        "v": "Charleston, Providence, and others (multiple bases)"
      },
      {
        "k": "Alliance",
        "v": "None (independent)"
      },
      {
        "k": "Founded",
        "v": "2021"
      },
      {
        "k": "Fleet Size",
        "v": "~70 aircraft"
      },
      {
        "k": "Income Tax",
        "v": "Yes (federal top rate 37%)"
      }
    ],
    "salaryNote": "Salaries are USD-denominated and quoted pre-tax, converted at USD/JPY = 150. Pay is set on a seniority system. As a start-up carrier, Breeze's pay scales are still being established, and terms may fluctuate during this growth phase.",
    "ops": {
      "routes": "Nonstop routes between small- and mid-sized U.S. cities (Charleston, Providence, Tulsa, etc.). Focused on a no-connection, point-to-point model.",
      "fleet": "Airbus A220-300, Embraer E190/E195. Approximately 70 aircraft."
    },
    "training": [
      {
        "title": "Type Rating Training (FAA-approved)",
        "body": "Type rating training at an FAA-certified ATO (Approved Training Organization). Conducted at Part 142 training centers (CAE, FlightSafety, etc.). Ground school → simulator → LOFT."
      },
      {
        "title": "IOE (Initial Operating Experience)",
        "body": "After obtaining the type rating, Initial Operating Experience is flown under the supervision of a Check Airman. Typically around 25–50 legs."
      },
      {
        "title": "Recurrent Checks (PC/LOE)",
        "body": "Proficiency Checks (PC) or Line Operational Evaluations (LOE) once or twice a year, in accordance with FAA Part 121/135."
      },
      {
        "title": "Upgrade to Captain",
        "body": "Primarily seniority-based. Requires meeting the flight-hour minimum (typically 5,000–8,000+ hours) and passing a check with a Check Airman. An R-ATP (1,500-hour) pathway is available."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Staff Travel (Pass)",
        "body": "Pass travel for the employee and family. Free or heavily discounted travel on Breeze flights and partner airlines."
      },
      {
        "icon": "🏥",
        "title": "Medical, Dental & Vision Insurance",
        "body": "Comprehensive health insurance for the employee and family. Loss-of-license insurance is also common."
      },
      {
        "icon": "💰",
        "title": "401(k) Retirement Plan",
        "body": "A defined-contribution 401(k) plan with company matching, commonly up to 5–16%."
      },
      {
        "icon": "📅",
        "title": "Paid Leave",
        "body": "Roughly 15–30 days per year (increasing with seniority). Flexible time-off options such as flips and skips."
      },
      {
        "icon": "💵",
        "title": "Per Diem",
        "body": "A daily allowance on flying days (roughly $2–4 per hour). Differs between domestic and international flying."
      },
      {
        "icon": "🌐",
        "title": "International Flying Allowance",
        "body": "Additional allowances and lodging expenses for crew on international flights."
      }
    ],
    "hiringStatus": "Actively hiring — open to FAA ATP holders; in a growth phase.",
    "hiringColor": "#34d399",
    "jobs": [
      {
        "title": "Captain & First Officer (Actively Hiring)",
        "sub": "Domestic flying. Choice of multiple bases.",
        "status": "Actively hiring",
        "statusTag": "green",
        "details": [
          {
            "k": "License",
            "v": "FAA ATP (1,500 hrs)"
          },
          {
            "k": "English",
            "v": "Native or fluent"
          },
          {
            "k": "Min. Flight Hours",
            "v": "To be confirmed (requirements may be relaxed during growth)"
          },
          {
            "k": "Work Eligibility",
            "v": "U.S. citizenship / permanent residency / work visa required"
          }
        ],
        "note": "As a start-up carrier, upgrades may come quickly. A220 type rating holders preferred."
      }
    ],
    "recruitUrl": "https://www.flybreeze.com/about/careers"
  },
  {
    "file": "aeromexico.html",
    "code": "AM",
    "color": "#006CB7",
    "nameEn": "Aeromexico",
    "subtitle": "Aeromexico — Mexico's flag carrier and a SkyTeam member.",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🇲🇽 Mexico"
      },
      {
        "cls": "tag-blue",
        "label": "SkyTeam"
      },
      {
        "cls": "tag-gray",
        "label": "FSC"
      },
      {
        "cls": "tag-orange",
        "label": "Latin America"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "~120",
        "label": "Fleet Size"
      },
      {
        "val": "90+",
        "label": "Cities Served"
      }
    ],
    "overview": [
      "Aeromexico is Mexico's flag carrier. From its hub in Mexico City it serves Latin America, North America (in partnership with Delta Air Lines), Europe and Asia, and it is a member of <strong>SkyTeam</strong>. The airline filed for U.S. Chapter 11 bankruptcy protection in 2020 and completed its restructuring in 2022. It maintains a deep partnership with Delta Air Lines, and the <strong>Boeing 787-8/9</strong> is the mainstay of its international operation."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Mexico City, Mexico"
      },
      {
        "k": "Hub",
        "v": "Benito Juárez International Airport (MEX)"
      },
      {
        "k": "Alliance",
        "v": "SkyTeam"
      },
      {
        "k": "Founded",
        "v": "1934"
      },
      {
        "k": "Fleet",
        "v": "Approx. 120 aircraft"
      },
      {
        "k": "Income Tax",
        "v": "Yes (top rate 35%)"
      }
    ],
    "salaryNote": "Captains fly international routes (B787/B737) and, for foreign hires, are paid in USD; First Officers fly both domestic and international routes and are paid in MXN/USD. Figures shown are reference values based on publicly available data and industry benchmarks — confirm actual pay conditions with the airline's own recruitment information. Yen conversions assume USD/JPY = 150. The cost of living in Mexico City is low, so USD-denominated income carries strong purchasing power. Mexico levies income tax, with a top rate of 35%.",
    "ops": {
      "routes": "From its Mexico City hub, Aeromexico serves North America (more than 60 U.S. cities, in partnership with Delta Air Lines), Latin America (more than 30 cities), Europe (Madrid, Amsterdam and others) and Asia (Tokyo and others).",
      "fleet": "Boeing 787-8/9, B737 MAX 9, B737-800. Approximately 120 aircraft."
    },
    "training": [
      {
        "title": "Type Rating Training (ICAO / national authority approved)",
        "body": "Type rating training is conducted at training centers certified by the relevant national civil aviation authority (ANAC, Aerocivil, DGAC, etc.) or compliant with FAA/EASA standards."
      },
      {
        "title": "LIFUS",
        "body": "After the type rating is obtained, line training is flown with an instructor captain on board."
      },
      {
        "title": "Recurrent Checks",
        "body": "Proficiency Checks once or twice a year, in accordance with each country's regulations."
      },
      {
        "title": "FO-to-Captain Upgrade",
        "body": "Seniority-based systems are the norm. Flight-hour requirements depend on the individual airline and on national regulations."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Staff Travel",
        "body": "Discounted travel privileges for the employee and family members. Usable on alliance partner airlines as well."
      },
      {
        "icon": "🏥",
        "title": "Medical Insurance",
        "body": "Medical insurance for the employee and family members, combined with the country's public healthcare system."
      },
      {
        "icon": "💰",
        "title": "Bonus",
        "body": "Performance-linked bonus, paid once or twice a year."
      },
      {
        "icon": "📅",
        "title": "Paid Leave",
        "body": "15–25 days per year, in line with each country's labor law."
      }
    ],
    "hiringStatus": "Hiring (post-restructuring). Open to ATPL holders.",
    "hiringColor": "#f5c842",
    "jobs": [
      {
        "title": "Captain / First Officer (Now Hiring)",
        "sub": "International route flying. Mexico City base.",
        "status": "Now Hiring",
        "statusTag": "blue",
        "details": [
          {
            "k": "License Required",
            "v": "ATPL (AFAC / ICAO compliant)"
          },
          {
            "k": "English",
            "v": "ICAO Level 4 or above"
          },
          {
            "k": "Minimum Flight Hours",
            "v": "Captain: 5,000+ hours (B787 experience preferred)"
          },
          {
            "k": "Spanish",
            "v": "Conversational level recommended"
          }
        ],
        "note": "The partnership with Delta Air Lines brings a large number of codeshare routes. Mexico City is Latin America's business hub."
      }
    ],
    "recruitUrl": "https://www.aeromexico.com/es-mx/sobre-aeromexico/trabaja-con-nosotros"
  },
  {
    "file": "avianca.html",
    "code": "AV",
    "color": "#C60B1E",
    "nameEn": "Avianca",
    "subtitle": "Avianca — Colombia's largest airline and the second-oldest carrier in the world.",
    "tags": [
      {
        "cls": "tag-red",
        "label": "🇨🇴 Colombia"
      },
      {
        "cls": "tag-blue",
        "label": "Star Alliance"
      },
      {
        "cls": "tag-gray",
        "label": "FSC"
      },
      {
        "cls": "tag-orange",
        "label": "Latin America"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "~130 aircraft",
        "label": "Fleet Size"
      },
      {
        "val": "100+ cities",
        "label": "Destinations"
      }
    ],
    "overview": [
      "Avianca was founded in 1919, making it the second-oldest airline in the world. Operating out of its hub in Bogotá, Colombia, it serves Latin America, North America, Europe and the Caribbean, and is a member of Star Alliance. The airline filed for bankruptcy protection in 2020 and completed its restructuring in 2021. It continues to drive efficiency with a simple fleet built around the A320 family."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Bogotá, Colombia"
      },
      {
        "k": "Hub",
        "v": "El Dorado International Airport (BOG)"
      },
      {
        "k": "Alliance",
        "v": "Star Alliance"
      },
      {
        "k": "Founded",
        "v": "1919"
      },
      {
        "k": "Fleet",
        "v": "~130 aircraft"
      },
      {
        "k": "Income Tax",
        "v": "Applicable (Colombia)"
      }
    ],
    "salaryNote": "Captain packages for foreign pilots are denominated in USD, while First Officer packages are denominated in COP/USD. Colombia levies personal income tax, so pay is not tax-free. The cost of living in Colombia is low, so the real purchasing power of USD-denominated income is high. Yen figures are converted at USD/JPY = 150.",
    "ops": {
      "routes": "From its Bogotá hub, Avianca serves Latin America (Mexico City, Lima, Buenos Aires and others), North America (Miami, New York, Los Angeles), Europe (Madrid, London) and the Caribbean.",
      "fleet": "Airbus A321neo, A320neo and A319. Approximately 130 aircraft (post-restructuring)."
    },
    "training": [
      {
        "title": "Type Rating Training (ICAO / national authority approved)",
        "body": "Type rating training conducted at training centers certified by the relevant national civil aviation authority (ANAC, Aerocivil, DGAC, etc.) or compliant with FAA/EASA standards."
      },
      {
        "title": "LIFUS",
        "body": "After obtaining the type rating, line training is carried out under the supervision of an instructor captain."
      },
      {
        "title": "Recurrent Checks",
        "body": "Proficiency Check once or twice a year, in accordance with each country's regulations."
      },
      {
        "title": "Upgrade to Captain",
        "body": "Seniority-based systems are the norm. Flight-hour requirements depend on each airline and each country's regulations."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Staff Travel",
        "body": "Discounted travel benefits for the pilot and family members. Usable on alliance partner airlines."
      },
      {
        "icon": "🏥",
        "title": "Medical Insurance",
        "body": "Medical insurance for the pilot and family members, combined with each country's public healthcare scheme."
      },
      {
        "icon": "💰",
        "title": "Bonus",
        "body": "Performance-linked bonus, paid once or twice a year."
      },
      {
        "icon": "📅",
        "title": "Paid Leave",
        "body": "15–25 days per year, in accordance with each country's labour law."
      }
    ],
    "hiringStatus": "Now hiring (post-restructuring). Open to ATPL holders.",
    "hiringColor": "#f5c842",
    "jobs": [
      {
        "title": "Captain / First Officer (Now Hiring)",
        "sub": "Domestic and international operations. Bogotá-based.",
        "status": "Now Hiring",
        "statusTag": "blue",
        "details": [
          {
            "k": "License",
            "v": "ATPL (AEROCIVIL / ICAO-compliant)"
          },
          {
            "k": "English",
            "v": "ICAO Level 4 or above"
          },
          {
            "k": "Min. Flight Hours",
            "v": "Captain 4,500h+ (guideline)"
          },
          {
            "k": "Spanish",
            "v": "Conversational level recommended"
          }
        ],
        "note": "Bogotá is a highland city at an altitude of 2,640 m. The climate is cool and comfortable, and the cost of living is low."
      }
    ],
    "recruitUrl": "https://www.avianca.com/co/es/sobre-avianca/trabaja-con-nosotros/"
  },
  {
    "file": "copa-airlines.html",
    "code": "CM",
    "color": "#004A94",
    "nameEn": "Copa Airlines",
    "subtitle": "Copa Airlines — Panama hub · network cornerstone for Latin American routes",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🇵🇦 Panama"
      },
      {
        "cls": "tag-blue",
        "label": "Star Alliance"
      },
      {
        "cls": "tag-gray",
        "label": "FSC"
      },
      {
        "cls": "tag-gold",
        "label": "Latin America Hub"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "~100 aircraft",
        "label": "Fleet Size"
      },
      {
        "val": "80+ cities",
        "label": "Destination Cities"
      }
    ],
    "overview": [
      "Copa Airlines is Latin America's single most important connecting-hub carrier, built around its hub in Panama City. It is a <strong>Star Alliance</strong> member and maintains a deep partnership with United Airlines, its major shareholder. Serving routes to more than 80 cities across Latin America, it functions as the hub of Latin America. Panama uses the US dollar as its official currency and tax rates are on the low side (income tax topping out at 25%). The airline operates a modern, well-maintained fleet centered on the <strong>Boeing 737 MAX</strong>."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Panama City, Panama"
      },
      {
        "k": "Hub",
        "v": "Tocumen International Airport (PTY)"
      },
      {
        "k": "Alliance",
        "v": "Star Alliance"
      },
      {
        "k": "Founded",
        "v": "1947"
      },
      {
        "k": "Fleet",
        "v": "Approx. 100 aircraft"
      },
      {
        "k": "Income Tax",
        "v": "Yes (top rate 25%)"
      }
    ],
    "salaryNote": "Pay is denominated in US dollars and quoted pre-tax. Panama is a dollarized economy, so there is no foreign-exchange risk on pay; income tax applies, at a top rate of 25%. Cost of living in Central America is comparatively low. Yen equivalents shown on this page are converted at USD/JPY = 150.",
    "ops": {
      "routes": "From the Panama City hub, Copa serves more than 80 cities across Latin America, plus North America (Miami, New York and others) and the Caribbean. Within Latin America it has the densest network of any carrier.",
      "fleet": "Boeing 737 MAX 8/9/10 and Boeing 737-800. Approximately 100 aircraft."
    },
    "training": [
      {
        "title": "Type Rating Training (ICAO / national-authority approved)",
        "body": "Type rating training at a center certified by the relevant national civil aviation authority (ANAC / Aerocivil / DGAC, etc.) or compliant with FAA / EASA standards."
      },
      {
        "title": "LIFUS",
        "body": "After the type rating is issued, line training is flown under the supervision of an instructor captain."
      },
      {
        "title": "Recurrent Checks",
        "body": "Proficiency checks one to two times per year, in accordance with each country's regulations."
      },
      {
        "title": "Upgrade to Captain",
        "body": "Seniority-based progression is the norm. Flight-hour requirements depend on the airline and on national regulations."
      }
    ],
    "benefits": [
      {
        "icon": "💵",
        "title": "USD salary (no FX risk)",
        "body": "Panama is part of the dollar economy. Because pay is denominated in USD, there is no exchange-rate risk."
      },
      {
        "icon": "✈️",
        "title": "Staff travel",
        "body": "Discounted travel privileges for the pilot and family. Star Alliance partner airlines can also be used."
      },
      {
        "icon": "🏥",
        "title": "Medical insurance",
        "body": "Comprehensive medical insurance covering the pilot and family."
      },
      {
        "icon": "💰",
        "title": "Bonus",
        "body": "Performance-linked bonus, tied to Panama's economic growth."
      }
    ],
    "hiringStatus": "Recruiting on a regular basis. Open to ATPL holders. B737 type-rated candidates preferred.",
    "hiringColor": "#34d399",
    "jobs": [
      {
        "title": "Captain / First Officer (regular recruitment)",
        "sub": "International operations. Panama City base.",
        "status": "Now Hiring",
        "statusTag": "green",
        "details": [
          {
            "k": "License",
            "v": "ATPL (AAC / ICAO-compliant)"
          },
          {
            "k": "English",
            "v": "ICAO Level 4 or above"
          },
          {
            "k": "Minimum flight hours",
            "v": "Captain: 5,000h or more (B737 MAX experience preferred)"
          },
          {
            "k": "Spanish",
            "v": "Conversational level recommended"
          }
        ],
        "note": "Panama is Central America's financial and business hub. USD-denominated pay combined with a low cost of living is a key attraction."
      }
    ],
    "recruitUrl": "https://www.copaair.com/en/web/us/work-with-us"
  },
  {
    "file": "latam.html",
    "code": "LA",
    "color": "#E30613",
    "nameEn": "LATAM Airlines",
    "subtitle": "LATAM Airlines — South America's largest airline group, integrating operations across six countries.",
    "tags": [
      {
        "cls": "tag-red",
        "label": "🇧🇷🇨🇱 South America"
      },
      {
        "cls": "tag-gray",
        "label": "FSC"
      },
      {
        "cls": "tag-gray",
        "label": "Independent"
      },
      {
        "cls": "tag-gold",
        "label": "No.1 in South America"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "~310",
        "label": "Fleet Size"
      },
      {
        "val": "150+",
        "label": "Destinations"
      }
    ],
    "overview": [
      "LATAM Airlines is <strong>South America's largest airline group</strong>, created by the 2012 merger of LAN (Chile) and TAM (Brazil). It holds regional operating companies in Chile, Brazil, Colombia, Ecuador, Peru and Paraguay, and serves destinations within South America as well as Europe, North America and Oceania. The group filed for protection under U.S. federal bankruptcy law in 2020 and completed its restructuring in 2022. The A320 family, together with the Boeing 787 and Airbus A350, forms the backbone of the fleet."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Santiago, Chile"
      },
      {
        "k": "Hub",
        "v": "Santiago (SCL) / São Paulo (GRU)"
      },
      {
        "k": "Alliance",
        "v": "None (independent; former Oneworld member, since withdrawn)"
      },
      {
        "k": "Founded",
        "v": "2012 (merger of LAN and TAM)"
      },
      {
        "k": "Fleet Size",
        "v": "Approx. 310 aircraft"
      },
      {
        "k": "Income Tax",
        "v": "Applicable (varies by country)"
      }
    ],
    "salaryNote": "Figures are converted at USD/JPY = 150. Foreign captains are generally paid in USD, while First Officers are typically paid in BRL or CLP, so the currency of payment and the applicable tax rate differ according to nationality and country of base. Terms reflect the conditions in place following the 2022 completion of restructuring.",
    "ops": {
      "routes": "From the Santiago and São Paulo hubs, LATAM serves the whole of South America as well as North America (Miami, New York and others), Europe (Madrid, London, Frankfurt and others) and Oceania (Sydney).",
      "fleet": "Boeing 787-8/9, Airbus A350-900, A321neo, A320neo and A319. Approximately 310 aircraft."
    },
    "training": [
      {
        "title": "Type Rating Training (ICAO / national authority approved)",
        "body": "Type rating training is conducted at training centres certified by the relevant national civil aviation authority (ANAC, Aerocivil, DGAC and others) or compliant with FAA/EASA standards."
      },
      {
        "title": "LIFUS",
        "body": "After the type rating is obtained, line training is flown under the supervision of an instructor captain."
      },
      {
        "title": "Recurrent Checks",
        "body": "A Proficiency Check is carried out once or twice a year, in accordance with each country's regulations."
      },
      {
        "title": "Upgrade to Captain",
        "body": "Seniority-based progression is the norm. Flight hour requirements depend on the individual operating company and the applicable national regulations."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Staff Travel",
        "body": "Discounted travel privileges for the employee and family members, also usable on alliance partner airlines."
      },
      {
        "icon": "🏥",
        "title": "Medical Insurance",
        "body": "Medical insurance for the employee and family, combined with each country's public healthcare system."
      },
      {
        "icon": "💰",
        "title": "Bonus",
        "body": "Performance-linked bonus, paid once or twice a year."
      },
      {
        "icon": "📅",
        "title": "Paid Leave",
        "body": "15 to 25 days per year, in line with each country's labour law."
      }
    ],
    "hiringStatus": "Hiring (following restructuring). Proven track record of hiring foreign pilots.",
    "hiringColor": "#f5c842",
    "jobs": [
      {
        "title": "Captain / First Officer (Now Hiring)",
        "sub": "International operations. Santiago / São Paulo based.",
        "status": "Now Hiring",
        "statusTag": "blue",
        "details": [
          {
            "k": "License",
            "v": "ATPL (ICAO-compliant, certified by the relevant national authority)"
          },
          {
            "k": "English",
            "v": "ICAO Level 4 or above"
          },
          {
            "k": "Minimum Flight Hours",
            "v": "Captain: 5,000 hours or more (guideline)"
          },
          {
            "k": "Spanish",
            "v": "Recommended (for the Chilean / Colombian operations)"
          }
        ],
        "note": "Note: Portuguese is used in Brazil and Spanish in Chile. A work permit must be obtained in accordance with each country's regulations."
      }
    ],
    "recruitUrl": "https://www.latamairlines.com/br/en/latam-group/working-at-latam"
  },
  {
    "file": "frontier.html",
    "code": "F9",
    "color": "#00AE42",
    "nameEn": "Frontier Airlines",
    "subtitle": "Frontier Airlines — an environmentally minded U.S. ultra-low-cost carrier, famous for the animal designs on its tail fins.",
    "tags": [
      {
        "cls": "tag-green",
        "label": "🇺🇸 United States"
      },
      {
        "cls": "tag-orange",
        "label": "ULCC"
      },
      {
        "cls": "tag-gray",
        "label": "Independent"
      },
      {
        "cls": "tag-blue",
        "label": "Colorado"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "~130",
        "label": "Fleet Size"
      },
      {
        "val": "100+",
        "label": "Cities Served"
      }
    ],
    "overview": [
      "Frontier Airlines is a Denver-based ULCC known for its distinctive branding, which gives every aircraft a different animal design on its tail. With a fleet standardized on the A320 family, it serves destinations across the United States, the Caribbean, Mexico, and Latin America. Merger talks with Spirit Airlines broke down in 2023. Operating highly fuel-efficient aircraft, the carrier positions itself as a <strong>\"green airline\"</strong>."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Denver, Colorado (USA)"
      },
      {
        "k": "Hub",
        "v": "Denver (DEN)"
      },
      {
        "k": "Alliance",
        "v": "None (independent)"
      },
      {
        "k": "Founded",
        "v": "1994"
      },
      {
        "k": "Fleet Size",
        "v": "~130 aircraft"
      },
      {
        "k": "Income Tax",
        "v": "Yes (U.S. federal top rate 37%)"
      }
    ],
    "salaryNote": "Pay is denominated in USD and quoted pre-tax; U.S. income tax applies (federal top rate 37%). Yen equivalents are converted at USD/JPY = 150. Pay progression follows a seniority system, and among the ULCCs Frontier has maintained comparatively steady hiring. Figures published here are reference values based on public data and industry benchmarks — always confirm actual pay terms with the airline's own recruitment information.",
    "ops": {
      "routes": "Flies from the Denver hub to destinations throughout the United States, the Caribbean, Mexico, and Latin America. A large share of the network is seasonal.",
      "fleet": "Airbus A321neo, A320neo, A319. Approximately 130 aircraft."
    },
    "training": [
      {
        "title": "Type Rating Training (FAA-approved)",
        "body": "Type rating training at an FAA-certified ATO (Approved Training Organization), using Part 142 training centers such as CAE and FlightSafety. Ground school → simulator → LOFT."
      },
      {
        "title": "IOE (Initial Operating Experience)",
        "body": "After the type rating is issued, Initial Operating Experience is flown under the supervision of an instructor captain (Check Airman) — typically around 25–50 legs."
      },
      {
        "title": "Recurrent Checks (PC/LOE)",
        "body": "A Proficiency Check (PC) or Line Operational Evaluation (LOE) once or twice a year, conducted in accordance with FAA Part 121/135."
      },
      {
        "title": "Upgrade to Captain",
        "body": "Seniority-based as a rule. Candidates must meet the required flight hours (normally 5,000–8,000 hours or more) and pass a check ride with a Check Airman. An R-ATP (1,500h) provision is available."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Staff Travel (Pass)",
        "body": "Pass travel for the pilot and family — free or heavily discounted travel on Frontier's own flights and those of partner carriers."
      },
      {
        "icon": "🏥",
        "title": "Medical, Dental & Vision Insurance",
        "body": "Comprehensive health insurance for the pilot and family. Loss-of-license insurance is also standard."
      },
      {
        "icon": "💰",
        "title": "401(k) Retirement Plan",
        "body": "A defined-contribution 401(k) plan with company matching; matches of up to 5–16% are common."
      },
      {
        "icon": "📅",
        "title": "Paid Leave",
        "body": "Roughly 15–30 days a year, increasing with seniority. Flexible leave options such as flip and skip are available."
      },
      {
        "icon": "💵",
        "title": "Per Diem",
        "body": "A daily allowance on flight days (roughly $2–4 per hour). Rates differ between domestic and international flying."
      },
      {
        "icon": "🌐",
        "title": "International Flying Allowance",
        "body": "Additional allowances and hotel expenses for crew operating international flights."
      }
    ],
    "hiringStatus": "Recruiting on a regular basis. Open to FAA ATP holders. U.S. work authorization is required.",
    "hiringColor": "#34d399",
    "jobs": [
      {
        "title": "Captain / First Officer (Regular Recruitment)",
        "sub": "Domestic and international flying. Primarily Denver-based.",
        "status": "Now Hiring",
        "statusTag": "green",
        "details": [
          {
            "k": "License",
            "v": "FAA ATP (1,500h)"
          },
          {
            "k": "English",
            "v": "Native or fluent"
          },
          {
            "k": "Minimum Flight Hours",
            "v": "To be confirmed"
          },
          {
            "k": "Work Eligibility",
            "v": "U.S. citizenship / permanent residency / work visa required"
          }
        ],
        "note": "Applicants holding an A320-family Type Rating are given preference."
      }
    ],
    "recruitUrl": "https://www.flyfrontier.com/fly/about-us/careers/"
  },
  {
    "file": "spirit.html",
    "code": "NK",
    "color": "#FFD700",
    "nameEn": "Spirit Airlines",
    "subtitle": "Spirit Airlines — the largest ULCC in the United States, built entirely around an ultra-low-cost model.",
    "tags": [
      {
        "cls": "tag-gold",
        "label": "🇺🇸 United States"
      },
      {
        "cls": "tag-orange",
        "label": "ULCC"
      },
      {
        "cls": "tag-gray",
        "label": "Independent"
      },
      {
        "cls": "tag-red",
        "label": "In Reorganization"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "~190",
        "label": "Fleet Size"
      },
      {
        "val": "80+",
        "label": "Destinations"
      }
    ],
    "overview": [
      "Spirit Airlines is the largest ULCC (ultra-low-cost carrier) in the United States. It delivers low fares through a thoroughly <strong>unbundled</strong> strategy, charging separately for baggage, seat assignment and similar items on top of the base fare. In November 2024 the carrier filed for protection under the U.S. federal bankruptcy code and is currently working through reorganization proceedings (approved in January 2025). Its fleet is standardized on the A320 family. Hiring status following the reorganization should be confirmed directly with the company."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Miramar, Florida (USA)"
      },
      {
        "k": "Hub",
        "v": "Fort Lauderdale (FLL) / Atlanta"
      },
      {
        "k": "Alliance",
        "v": "None (independent)"
      },
      {
        "k": "Founded",
        "v": "1980"
      },
      {
        "k": "Fleet Size",
        "v": "Approx. 190 aircraft"
      },
      {
        "k": "Income Tax",
        "v": "Yes (federal top rate 37%)"
      }
    ],
    "salaryNote": "Pay is denominated in USD and quoted pre-tax; JPY equivalents are converted at USD/JPY = 150. Captain pay is benchmarked against U.S. industry norms, while First Officer progression is governed by a seniority-based scale. Figures published here are reference values derived from public data and industry standards — confirm actual compensation terms with the airline's own recruitment materials. Note that because the carrier has been in federal bankruptcy reorganization through 2024–2025, actual terms and hiring conditions may have shifted significantly.",
    "ops": {
      "routes": "Operates from its Fort Lauderdale and Atlanta hubs across the U.S. domestic network, the Caribbean, Latin America and Mexico.",
      "fleet": "Airbus A321neo/ceo, A320neo/ceo and A319. Approximately 190 aircraft."
    },
    "training": [
      {
        "title": "Type Rating Training (FAA-approved)",
        "body": "Type rating training is conducted at an FAA-certified ATO (Approved Training Organization), using Part 142 training centers such as CAE and FlightSafety. The sequence runs ground school → simulator → LOFT."
      },
      {
        "title": "IOE (Initial Operating Experience)",
        "body": "After the type rating is issued, Initial Operating Experience is flown under the supervision of an instructor captain (Check Airman). Typically around 25–50 legs."
      },
      {
        "title": "Recurrent Checks (PC / LOE)",
        "body": "A Proficiency Check (PC) or Line Operational Evaluation (LOE) is conducted once or twice a year, in accordance with FAA Part 121/135."
      },
      {
        "title": "Upgrade to Captain",
        "body": "Seniority is the primary basis for upgrade. Candidates must meet the required flight hours (normally 5,000–8,000+ hours) and pass a Check Airman evaluation. An R-ATP (1,500 h) pathway is available."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Staff Travel (Pass)",
        "body": "Pass travel for the pilot and family members, offering free or heavily discounted travel on Spirit's own flights and on partner carriers."
      },
      {
        "icon": "🏥",
        "title": "Medical, Dental & Vision Insurance",
        "body": "Comprehensive medical coverage for the pilot and family. Loss-of-license insurance is also common."
      },
      {
        "icon": "💰",
        "title": "401(k) Retirement Plan",
        "body": "A defined-contribution 401(k) plan with company matching. Matching of up to 5–16% is common."
      },
      {
        "icon": "📅",
        "title": "Paid Leave",
        "body": "Roughly 15–30 days per year, increasing with seniority. Flexible leave options such as flip and skip are available."
      },
      {
        "icon": "💵",
        "title": "Per Diem",
        "body": "A daily allowance paid for flight days (roughly $2–4 per hour). Rates differ between domestic and international flying."
      },
      {
        "icon": "🌐",
        "title": "International Flying Allowance",
        "body": "Additional allowances and hotel expenses paid to crew operating international routes."
      }
    ],
    "hiringStatus": "Filed for bankruptcy protection in November 2024 and remains in reorganization. Hiring status must be confirmed directly.",
    "hiringColor": "#6b7d93",
    "jobs": [
      {
        "title": "Captain / First Officer (hiring status to be confirmed)",
        "sub": "Domestic and international operations. Currently in reorganization proceedings.",
        "status": "Confirm with official source",
        "statusTag": "gray",
        "details": [
          {
            "k": "License",
            "v": "FAA ATP (1,500 h)"
          },
          {
            "k": "English",
            "v": "Native or fluent"
          },
          {
            "k": "Minimum Flight Hours",
            "v": "To be confirmed"
          },
          {
            "k": "Work Eligibility",
            "v": "U.S. citizenship / permanent residency / work visa required"
          }
        ],
        "note": "Because the airline is in the middle of a 2024–2025 federal bankruptcy filing and reorganization process, hiring and employment terms are unstable. Always verify the latest information."
      }
    ],
    "recruitUrl": "https://www.spirit.com/about/careers"
  },
  {
    "file": "porter.html",
    "code": "PD",
    "color": "#3D1152",
    "nameEn": "Porter Airlines",
    "subtitle": "Porter Airlines — Canada's premium LCC, transitioning from the Embraer fleet to the A220.",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🇨🇦 Canada"
      },
      {
        "cls": "tag-orange",
        "label": "Premium LCC"
      },
      {
        "cls": "tag-gray",
        "label": "Independent"
      },
      {
        "cls": "tag-gold",
        "label": "Eastern Canada"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "~80 aircraft",
        "label": "Fleet size (expanding)"
      },
      {
        "val": "30+ cities",
        "label": "Destinations"
      }
    ],
    "overview": [
      "Porter Airlines is a Canadian premium LCC based at Toronto's Billy Bishop Airport. Through a sweeping fleet renewal away from its traditional E175s, the carrier has adopted the A220-300 and is expanding its network across domestic Canada, the U.S. East Coast, the Caribbean and Mexico. It differentiates itself with a distinctive service aimed at business travelers, offering complimentary snacks, beer and wine. The airline is growing rapidly and hiring is active."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Toronto, Canada"
      },
      {
        "k": "Hub",
        "v": "Toronto Billy Bishop (YTZ) / Pearson (YYZ)"
      },
      {
        "k": "Alliance",
        "v": "None (independent)"
      },
      {
        "k": "Founded",
        "v": "2006"
      },
      {
        "k": "Fleet",
        "v": "~80 aircraft (expanding)"
      },
      {
        "k": "Income Tax",
        "v": "Yes (federal top rate 33% plus provincial tax)"
      }
    ],
    "salaryNote": "Pay is denominated in Canadian dollars (CAD) and quoted pre-tax; JPY figures on this site are converted at CAD/JPY = 110. Captain pay reflects domestic and international flying on the A220/E175, while First Officer pay follows a seniority-based system. The airline is in a rapid growth phase, so the hiring pace is fast. Figures published on this site are reference values based on public data and industry norms — confirm actual compensation terms via the airline's official recruitment information.",
    "ops": {
      "routes": "Operates from the Toronto hub to major Canadian cities (Vancouver, Calgary, Montreal and others) as well as the U.S. East Coast, Florida, the Caribbean and Mexico. The network is expanding on the back of the A220 introduction.",
      "fleet": "Airbus A220-300 and Embraer E175. Approximately 80 aircraft, with further orders on backlog."
    },
    "training": [
      {
        "title": "Type Rating Training (FAA-approved)",
        "body": "Type rating training at an FAA-certified ATO (Approved Training Organization), using Part 142 training centers such as CAE and FlightSafety. The sequence runs ground school → simulator → LOFT."
      },
      {
        "title": "IOE (Initial Operating Experience)",
        "body": "After the type rating is issued, Initial Operating Experience is flown alongside an instructor captain (Check Airman). Typically around 25 to 50 legs."
      },
      {
        "title": "Recurrent Checks (PC/LOE)",
        "body": "A Proficiency Check (PC) or Line Operational Evaluation (LOE) once or twice a year, conducted in accordance with FAA Part 121/135."
      },
      {
        "title": "Upgrade to Captain",
        "body": "Seniority-based as a rule. Candidates must meet the required flight hours (normally 5,000–8,000 hours or more) and pass a check ride with a Check Airman. An R-ATP (1,500-hour) pathway is available."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Staff Travel (Passes)",
        "body": "Pass travel for the employee and family — free or heavily discounted travel on the airline's own flights and with partner carriers."
      },
      {
        "icon": "🏥",
        "title": "Medical, Dental and Vision Insurance",
        "body": "Comprehensive medical coverage for the employee and family. Loss-of-license insurance is also common."
      },
      {
        "icon": "💰",
        "title": "401(k) Retirement Plan",
        "body": "A defined-contribution retirement plan (401(k)) with company matching. Matching of up to 5–16% is common."
      },
      {
        "icon": "📅",
        "title": "Paid Leave",
        "body": "Roughly 15–30 days per year, increasing with seniority. Flexible leave options such as flips and skips are available."
      },
      {
        "icon": "💵",
        "title": "Per Diem",
        "body": "A daily allowance for flying days (roughly $2–4 per hour). Rates differ between domestic and international operations."
      },
      {
        "icon": "🌐",
        "title": "International Flying Allowance",
        "body": "Additional allowances and accommodation expenses for crew operating international routes."
      }
    ],
    "hiringStatus": "Hiring is ramping up. Open to holders of a Transport Canada ATP.",
    "hiringColor": "#34d399",
    "jobs": [
      {
        "title": "Captain / First Officer (Actively Recruiting)",
        "sub": "Domestic and international flying. Toronto-based.",
        "status": "Actively Recruiting",
        "statusTag": "green",
        "details": [
          {
            "k": "Required License",
            "v": "Transport Canada ATPL"
          },
          {
            "k": "English",
            "v": "ICAO Level 4 or above"
          },
          {
            "k": "Minimum Flight Hours",
            "v": "4,500+ hours for Captain (guideline)"
          },
          {
            "k": "Work Eligibility",
            "v": "Canadian citizenship / permanent residency / work permit"
          }
        ],
        "note": "Hiring has surged with the introduction of the A220-300. Being in a growth phase, upgrade opportunities are also plentiful."
      }
    ],
    "recruitUrl": "https://www.flyporter.com/en-ca/about/careers"
  },
  {
    "file": "westjet.html",
    "code": "WS",
    "color": "#00439C",
    "nameEn": "WestJet Airlines",
    "subtitle": "WestJet Airlines — Canada's second-largest carrier, transitioning away from its low-cost origins.",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🇨🇦 Canada"
      },
      {
        "cls": "tag-gray",
        "label": "FSC/LCC Hybrid"
      },
      {
        "cls": "tag-gray",
        "label": "Independent"
      },
      {
        "cls": "tag-orange",
        "label": "Canada"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "~170 aircraft",
        "label": "Fleet Size"
      },
      {
        "val": "100+ cities",
        "label": "Destinations"
      }
    ],
    "overview": [
      "WestJet Airlines is <strong>Canada's second-largest airline</strong>. From its hub in Calgary it serves destinations across Canada as well as the United States, the Caribbean, Mexico and Europe. The carrier was once oriented toward the low-cost model, but with the introduction of the Boeing 787 it has moved into long-haul routes and premium service as well. It also owns the ultra-low-cost subsidiary Swoop. Following extensive restructuring during the COVID-19 crisis of 2020–2022, the airline has since recovered."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Calgary, Canada"
      },
      {
        "k": "Hub",
        "v": "Calgary (YYC)"
      },
      {
        "k": "Alliance",
        "v": "None (independent)"
      },
      {
        "k": "Founded",
        "v": "1994"
      },
      {
        "k": "Fleet Size",
        "v": "Approx. 170 aircraft"
      },
      {
        "k": "Income Tax",
        "v": "Yes (federal top rate 33% plus provincial tax)"
      }
    ],
    "salaryNote": "Pay is denominated in CAD and quoted pre-tax, with progression governed by a seniority system. Canadian income tax (federal plus provincial combined) reaches a top rate of roughly 50%. Yen figures are converted at CAD/JPY = 110.",
    "ops": {
      "routes": "From its Calgary hub, WestJet serves destinations throughout Canada, the United States (more than 60 cities), the Caribbean, Hawaii, Mexico and Europe (London and others).",
      "fleet": "Boeing 787-9, B737 MAX 8/10 and B737-800. Approximately 170 aircraft."
    },
    "training": [
      {
        "title": "Type Rating Training (FAA-approved)",
        "body": "Type rating training is conducted at an FAA-certified ATO (Approved Training Organization), using Part 142 training centres such as CAE and FlightSafety. The sequence runs from ground school to simulator sessions to LOFT."
      },
      {
        "title": "IOE (Initial Operating Experience)",
        "body": "After the type rating is obtained, Initial Operating Experience is flown under the supervision of an instructor captain (Check Airman). This typically covers around 25 to 50 legs."
      },
      {
        "title": "Recurrent Checks (PC/LOE)",
        "body": "A Proficiency Check (PC) or Line Operational Evaluation (LOE) is conducted once or twice a year, in accordance with FAA Part 121/135."
      },
      {
        "title": "Upgrade to Captain",
        "body": "Upgrades are fundamentally seniority-based. Candidates must meet the required flight hours (typically 5,000–8,000 hours or more) and pass a check conducted by a Check Airman. An R-ATP (1,500 hours) pathway also exists."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Staff Travel (Pass)",
        "body": "Pass travel for the employee and family members, offering free or heavily discounted travel on WestJet flights and with partner carriers."
      },
      {
        "icon": "🏥",
        "title": "Medical, Dental & Vision Insurance",
        "body": "Comprehensive medical insurance covering the employee and family. Loss-of-licence insurance is also commonly provided."
      },
      {
        "icon": "💰",
        "title": "401(k) Retirement Plan",
        "body": "A defined-contribution retirement plan (401(k)) with company matching. Matching of up to 5–16% is common."
      },
      {
        "icon": "📅",
        "title": "Paid Leave",
        "body": "Roughly 15–30 days per year, increasing with seniority. Flexible leave options such as flips and skips are available."
      },
      {
        "icon": "💵",
        "title": "Per Diem",
        "body": "A daily allowance paid on flight days (roughly $2–4 per hour). Rates differ between domestic and international operations."
      },
      {
        "icon": "🌐",
        "title": "International Flight Allowance",
        "body": "Additional allowances and accommodation coverage for crew operating international flights."
      }
    ],
    "hiringStatus": "Hiring on a regular basis. Open to holders of a Transport Canada ATP.",
    "hiringColor": "#34d399",
    "jobs": [
      {
        "title": "Captain / First Officer (Regular Recruitment)",
        "sub": "Domestic and international flying. Calgary-based.",
        "status": "Now Hiring",
        "statusTag": "green",
        "details": [
          {
            "k": "License Required",
            "v": "Transport Canada ATPL"
          },
          {
            "k": "English",
            "v": "ICAO Level 4 or above"
          },
          {
            "k": "Minimum Flight Hours",
            "v": "5,000 h or more for Captain (guideline)"
          },
          {
            "k": "Work Eligibility",
            "v": "Canadian citizenship / permanent residency / work permit"
          }
        ],
        "note": "Alberta is the only province in Canada with no provincial income tax. Calgary's cost of living is also lower than on the east coast."
      }
    ],
    "recruitUrl": "https://www.westjet.com/en-ca/about-westjet/careers"
  },
  {
    "file": "solairus.html",
    "code": "SOL",
    "color": "#3d9bff",
    "nameEn": "Solairus Aviation",
    "subtitle": "Solairus Aviation — a major private aviation company in the United States.",
    "tags": [
      {
        "cls": "tag-orange",
        "label": "🇺🇸 United States"
      },
      {
        "cls": "tag-gold",
        "label": "Business Jet"
      },
      {
        "cls": "tag-blue",
        "label": "G600 Captain"
      },
      {
        "cls": "tag-gray",
        "label": "Texas"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "Texas",
        "label": "Work Location"
      },
      {
        "val": "Gulfstream G600",
        "label": "Aircraft Type"
      }
    ],
    "overview": [
      "Solairus Aviation is one of the largest private aviation companies in the United States. It provides charter jet flight operations and aircraft management for corporate and private clients, delivering high-quality business jet services from bases across the U.S. The company is currently hiring <strong>Gulfstream G600 Captains</strong> based in Austin, Texas — an opportunity to fly one of the top-tier aircraft in the private aviation sector."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "California, United States"
      },
      {
        "k": "Assignment Base",
        "v": "Austin, Texas"
      },
      {
        "k": "Type of Operation",
        "v": "Private charter (Part 135)"
      },
      {
        "k": "Aircraft Type",
        "v": "Gulfstream G600"
      },
      {
        "k": "Employment Type",
        "v": "Full-time employee"
      },
      {
        "k": "Income Tax",
        "v": "Applicable (U.S. federal and state tax)"
      }
    ],
    "salaryNote": "Figures are converted at USD/JPY ≈ 125 (as of March 2026). Compensation reflects the going rate for Gulfstream G600 Captains in U.S. private aviation. U.S. federal and state income tax applies. Actual terms should be confirmed directly with Solairus Aviation.",
    "ops": {
      "routes": "Flights throughout the United States as well as international charters, driven primarily by business demand. Operations are centered on flights between major cities from the Austin base.",
      "fleet": "Gulfstream G600 (the company also operates the G550, G450, Challenger and other types)."
    },
    "training": [
      {
        "title": "G600 Type Rating Training",
        "body": "A Gulfstream G600 type rating is required. Training is conducted at providers such as FlightSafety or CAE."
      },
      {
        "title": "Part 135 Training",
        "body": "Training conducted in accordance with U.S. FAA Part 135 (charter operations) regulations."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Top-Tier Aircraft",
        "body": "Fly the Gulfstream G600, one of the highest-class business jets in service."
      },
      {
        "icon": "💰",
        "title": "Strong Compensation",
        "body": "Industry-leading terms for a business jet Captain."
      },
      {
        "icon": "🏠",
        "title": "Stable Base",
        "body": "Stable assignment based in Austin, Texas."
      }
    ],
    "hiringStatus": "Hiring (as of March 2026; applications close April 8, 2026)",
    "hiringColor": "#34d399",
    "jobs": [
      {
        "title": "Captain — Gulfstream G600",
        "sub": "Based in Austin, Texas",
        "status": "Now Hiring",
        "statusTag": "green",
        "details": [
          {
            "k": "Required Qualification",
            "v": "Gulfstream G600 (or G500) type rating"
          },
          {
            "k": "License",
            "v": "FAA ATP Certificate"
          },
          {
            "k": "Base",
            "v": "Austin, Texas"
          }
        ],
        "note": "Please refer to the original listing published on Latest Pilot Jobs for full details."
      }
    ],
    "recruitUrl": "https://www.latestpilotjobs.com/jobs/view/id/18579.html"
  },
  {
    "file": "air-new-zealand.html",
    "code": "NZ",
    "color": "#00539C",
    "nameEn": "Air New Zealand",
    "subtitle": "Air New Zealand — New Zealand's flag carrier, a multiple award winner for its innovative cabin products.",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🇳🇿 New Zealand"
      },
      {
        "cls": "tag-blue",
        "label": "Star Alliance"
      },
      {
        "cls": "tag-gray",
        "label": "FSC"
      },
      {
        "cls": "tag-green",
        "label": "Safety Award Winner"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "~100",
        "label": "Fleet Size"
      },
      {
        "val": "50+",
        "label": "Destinations"
      }
    ],
    "overview": [
      "Air New Zealand is New Zealand's flag carrier. From its Auckland hub it serves Asia (Tokyo, Shanghai and others), the Pacific (Los Angeles and others), Australia, the South Pacific and the United Kingdom. It is a member of Star Alliance. The airline has won numerous top scores from Airline Ratings for innovative cabin products such as the \"Skycouch\". The B787 and the ATR 72 are its mainstay aircraft."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Auckland, New Zealand"
      },
      {
        "k": "Hub",
        "v": "Auckland International Airport (AKL)"
      },
      {
        "k": "Alliance",
        "v": "Star Alliance"
      },
      {
        "k": "Founded",
        "v": "1940"
      },
      {
        "k": "Fleet",
        "v": "Approx. 100 aircraft"
      },
      {
        "k": "Income Tax",
        "v": "Yes (top rate 39%)"
      }
    ],
    "salaryNote": "Pay is denominated in NZD and quoted pre-tax, converted at approximately NZD/JPY ≈ 90 (subject to fluctuation). New Zealand income tax applies, with a top rate of 39%. Pay progression follows a seniority system. New Zealand also has a comprehensive accident compensation scheme through ACC.",
    "ops": {
      "routes": "Operating from the Auckland hub to Asia (Tokyo, Shanghai, Singapore and others), North America (Los Angeles, Houston and others), the United Kingdom, Australia and the South Pacific (the Cook Islands and others).",
      "fleet": "Boeing 787-9/10, ATR 72-600, and Boeing 777-200ER (being retired). Approximately 100 aircraft."
    },
    "training": [
      {
        "title": "Type Rating Training (CASA / CAA NZ approved)",
        "body": "Type rating training at a training centre approved by CASA (Australia) or CAA New Zealand, using either OEM centres or the airline's own simulators."
      },
      {
        "title": "LIFUS",
        "body": "After the type rating is obtained, line training is flown under the supervision of an instructor Captain — typically around 50 to 80 legs."
      },
      {
        "title": "Recurrent Checks (OPC / LPC)",
        "body": "Proficiency checks once or twice a year, conducted in compliance with each country's civil aviation regulations."
      },
      {
        "title": "Upgrade to Captain",
        "body": "Based primarily on the seniority system. Once the CASA / CAA NZ requirements are met, upgrade follows an in-house assessment."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Staff Travel",
        "body": "Discounted or complimentary travel privileges for the pilot and family, including alliance partner airlines."
      },
      {
        "icon": "🏥",
        "title": "Medical Insurance",
        "body": "Private medical insurance (including dental) on top of the Australian and New Zealand public health schemes (Medicare / ACC)."
      },
      {
        "icon": "💰",
        "title": "Superannuation (Retirement Pension)",
        "body": "Australia: Superannuation (statutory contributions of 11% or more); New Zealand: KiwiSaver. A well-funded scheme for retirement."
      },
      {
        "icon": "📅",
        "title": "Paid Leave",
        "body": "20 to 25 days per year, in accordance with Australian and New Zealand labour law."
      },
      {
        "icon": "💵",
        "title": "Per Diem",
        "body": "A daily allowance paid while on duty. Rates differ between domestic and international operations."
      },
      {
        "icon": "🌏",
        "title": "Route Diversity",
        "body": "Varied flying opportunities across South Pacific, Asian, European and North American routes as well as within Oceania."
      }
    ],
    "hiringStatus": "Regular recruitment ongoing. Open to holders of a CAA NZ ATPL. New Zealand work authorization required.",
    "hiringColor": "#34d399",
    "jobs": [
      {
        "title": "Captain / First Officer (Regular Recruitment)",
        "sub": "International operations. Auckland based.",
        "status": "Hiring",
        "statusTag": "green",
        "details": [
          {
            "k": "Required License",
            "v": "CAA NZ ATPL (or ICAO mutual recognition)"
          },
          {
            "k": "English",
            "v": "ICAO Level 4 or above"
          },
          {
            "k": "Minimum Flight Hours",
            "v": "5,000+ hours as Captain (B787 experience preferred)"
          },
          {
            "k": "Work Eligibility",
            "v": "NZ citizenship / permanent residency / work visa"
          }
        ],
        "note": "New Zealand offers relatively accessible working-holiday and permanent-residency pathways, along with a good living environment."
      }
    ],
    "recruitUrl": "https://www.airnewzealand.co.nz/careers"
  },
  {
    "file": "fiji-airways.html",
    "code": "FJ",
    "color": "#0073B0",
    "nameEn": "Fiji Airways",
    "subtitle": "Fiji Airways — Fiji's flag carrier and the gateway to the South Pacific.",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🇫🇯 Fiji"
      },
      {
        "cls": "tag-gray",
        "label": "FSC"
      },
      {
        "cls": "tag-green",
        "label": "South Pacific"
      },
      {
        "cls": "tag-gold",
        "label": "Hires Foreign Pilots"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "~15",
        "label": "Fleet Size"
      },
      {
        "val": "15+",
        "label": "Destinations"
      }
    ],
    "overview": [
      "Fiji Airways is the flag carrier of Fiji. Operating from its hub in Nadi, it serves Australia, New Zealand, North America, Japan, Hong Kong, Singapore and other markets, and plays an important role as the South Pacific's tourism hub. The airline has a track record of hiring foreign pilots. It runs a simple fleet built around the A350 and the B737. The appeal lies in Fiji's low tax burden and the lifestyle that only an island nation can offer."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Nadi, Fiji"
      },
      {
        "k": "Hub",
        "v": "Nadi International Airport (NAN)"
      },
      {
        "k": "Alliance",
        "v": "None (independent)"
      },
      {
        "k": "Founded",
        "v": "1951"
      },
      {
        "k": "Fleet Size",
        "v": "approx. 15 aircraft"
      },
      {
        "k": "Income Tax",
        "v": "Applicable (Fiji)"
      }
    ],
    "salaryNote": "Figures are reference values based on publicly available data and industry benchmarks; confirm actual terms with the airline's own recruitment materials. Yen conversions use USD/JPY = 150. Foreign pilots are typically engaged on special expatriate contracts denominated in USD, with First Officer packages quoted in USD or Fijian dollars (FJD). Fiji levies income tax, but the cost of living is low and the South Pacific island lifestyle is a major part of the overall package.",
    "ops": {
      "routes": "From its Nadi hub, Fiji Airways serves Australia (Sydney, Melbourne, Brisbane and others), New Zealand (Auckland), North America (Los Angeles, San Francisco), Japan (Narita, Kansai), as well as Hong Kong, Singapore and other destinations.",
      "fleet": "Airbus A350-900, Boeing 737-800 / MAX 8. Approximately 15 aircraft."
    },
    "training": [
      {
        "title": "Type Rating Training (CASA / CAA NZ approved)",
        "body": "Type rating training at a training center accredited by CASA (Australia) or the CAA New Zealand. Conducted at OEM centers or on the airline's own simulators."
      },
      {
        "title": "LIFUS",
        "body": "After obtaining the type rating, line training flown alongside an instructor captain. Typically around 50 to 80 legs."
      },
      {
        "title": "Recurrent Checks (OPC / LPC)",
        "body": "Proficiency checks one to two times per year, in compliance with the civil aviation regulations of each relevant authority."
      },
      {
        "title": "Upgrade to Captain",
        "body": "Seniority-based as a rule. Once the CASA / CAA NZ requirements are met, the upgrade is granted following an internal assessment."
      }
    ],
    "benefits": [
      {
        "icon": "🌊",
        "title": "South Pacific Lifestyle",
        "body": "Fiji's beautiful ocean, nature and island culture. An attractive living environment even when relocating with family."
      },
      {
        "icon": "✈️",
        "title": "Staff Travel",
        "body": "Discounted travel privileges for the pilot and their family."
      },
      {
        "icon": "🏥",
        "title": "Medical Insurance",
        "body": "Medical insurance for foreign pilots. A housing allowance is also common."
      },
      {
        "icon": "💵",
        "title": "USD-Denominated Pay",
        "body": "Foreign-pilot contracts are generally denominated in USD, which keeps foreign-exchange risk low."
      }
    ],
    "hiringStatus": "Proven track record of hiring foreign Captains and First Officers. A350 or B737 type rating holders are preferred.",
    "hiringColor": "#f5c842",
    "jobs": [
      {
        "title": "Captain / First Officer (Foreign Pilot Recruitment)",
        "sub": "International operations. Nadi-based.",
        "status": "Ad-hoc Hiring",
        "statusTag": "blue",
        "details": [
          {
            "k": "License",
            "v": "ATPL (ICAO-compliant)"
          },
          {
            "k": "English",
            "v": "ICAO Level 4 or above"
          },
          {
            "k": "Min. Flight Hours",
            "v": "Captain 4,500h+ (guideline)"
          },
          {
            "k": "Contract",
            "v": "Fixed-term contract (2–3 years), USD-denominated"
          }
        ],
        "note": "In Fiji, the tourism and aviation industries are closely intertwined. The airline also operates Japan routes, which gives it a natural affinity for Japanese pilots."
      }
    ],
    "recruitUrl": "https://www.fijiairways.com/about-fiji-airways/careers/"
  },
  {
    "file": "jetstar.html",
    "code": "JQ",
    "color": "#FF5900",
    "nameEn": "Jetstar Airways (Jetstar)",
    "subtitle": "Jetstar Airways — the Qantas Group's low-cost carrier, operating across the Asia-Pacific.",
    "tags": [
      {
        "cls": "tag-orange",
        "label": "🇦🇺 Australia"
      },
      {
        "cls": "tag-orange",
        "label": "LCC"
      },
      {
        "cls": "tag-blue",
        "label": "Qantas Group"
      },
      {
        "cls": "tag-green",
        "label": "Asia-Pacific"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "~90",
        "label": "Fleet Size"
      },
      {
        "val": "60+",
        "label": "Destinations"
      }
    ],
    "overview": [
      "Jetstar is a low-cost carrier established by the <strong>Qantas Group in 2004</strong>. It operates Australian domestic routes and Asia-Pacific services at low fares. In Japan, it is run as Jetstar Japan, a separate company. With group carriers spread across Australia, New Zealand, Singapore, Japan and Vietnam, Jetstar forms <strong>one of the largest LCC networks in the Asia-Pacific</strong>. The A320 family and the B787 are its mainstay aircraft."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Melbourne, Australia"
      },
      {
        "k": "Hub",
        "v": "Melbourne (MEL) / Sydney (SYD)"
      },
      {
        "k": "Alliance",
        "v": "Qantas Group (Oneworld-affiliated)"
      },
      {
        "k": "Founded",
        "v": "2004"
      },
      {
        "k": "Fleet",
        "v": "Approx. 90 aircraft"
      },
      {
        "k": "Income Tax",
        "v": "Applicable (top rate 45%)"
      }
    ],
    "salaryNote": "Figures published here are reference values based on publicly available data and prevailing industry levels; confirm actual pay conditions with each airline's own recruitment information. Pay is denominated in AUD and quoted pre-tax, converted at AUD/JPY = 98. Captain pay is benchmarked against industry standards, while First Officer pay progresses under a seniority system. Transfer opportunities within the Qantas Group are also available.",
    "ops": {
      "routes": "Operating from the Melbourne and Sydney hubs, Jetstar serves Australian domestic routes plus New Zealand, Asia (Japan, Thailand, Indonesia and others) and the Pacific island nations.",
      "fleet": "Boeing 787-8, Airbus A321 and A320. Approximately 90 aircraft."
    },
    "training": [
      {
        "title": "Type Rating Training (CASA / CAA NZ approved)",
        "body": "Type rating training at a training centre accredited by CASA (Australia) or the CAA New Zealand, using OEM centres or the airline's own simulators."
      },
      {
        "title": "LIFUS",
        "body": "After the type rating is obtained, line training is flown with an instructor captain on board — typically around 50 to 80 legs."
      },
      {
        "title": "Recurrent Checks (OPC / LPC)",
        "body": "Proficiency Checks once or twice a year, in accordance with each country's civil aviation regulations."
      },
      {
        "title": "Upgrade to Captain",
        "body": "Fundamentally seniority-based. Once the CASA / CAA NZ requirements are met, upgrade follows an internal assessment."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Staff Travel",
        "body": "Discounted or free travel privileges for the pilot and family, including partner carriers within the alliance."
      },
      {
        "icon": "🏥",
        "title": "Medical Insurance",
        "body": "Private medical insurance (including dental) on top of the public healthcare systems of Australia and New Zealand (Medicare / ACC)."
      },
      {
        "icon": "💰",
        "title": "Superannuation (Retirement Pension)",
        "body": "Australia: Superannuation (statutory contributions of 11% or more); New Zealand: KiwiSaver. A generous retirement savings framework."
      },
      {
        "icon": "📅",
        "title": "Paid Leave",
        "body": "20 to 25 days per year, in line with Australian and New Zealand labour law."
      },
      {
        "icon": "💵",
        "title": "Per Diem",
        "body": "Daily allowances while on duty, differing between domestic and international operations."
      },
      {
        "icon": "🌏",
        "title": "Route Variety",
        "body": "Diverse flying opportunities across the South Pacific, Asia, Europe and North America as well as within Oceania."
      },
      {
        "icon": "🦘",
        "title": "Qantas Group Privileges",
        "body": "Staff travel benefits on Qantas flights, with access to training facilities across the group."
      }
    ],
    "hiringStatus": "Recruiting on a regular cycle. Open to holders of a CASA ATPL. Australian work authorization is required.",
    "hiringColor": "#34d399",
    "jobs": [
      {
        "title": "Captain / First Officer (Regular Recruitment)",
        "sub": "Domestic and international flying. Melbourne / Sydney base.",
        "status": "Now Hiring",
        "statusTag": "green",
        "details": [
          {
            "k": "License required",
            "v": "CASA ATPL"
          },
          {
            "k": "English",
            "v": "ICAO Level 4 or above"
          },
          {
            "k": "Minimum flight hours",
            "v": "4,500+ hours for Captain (guideline)"
          },
          {
            "k": "Work eligibility",
            "v": "Australian citizenship / permanent residency / work visa"
          }
        ],
        "note": "Internal advancement within the Qantas Group may open the possibility of transferring to Qantas mainline."
      }
    ],
    "recruitUrl": "https://www.jetstar.com/au/en/about-us/careers"
  },
  {
    "file": "egyptair.html",
    "code": "MS",
    "color": "#2F5597",
    "nameEn": "EgyptAir",
    "subtitle": "EgyptAir — Egypt's state-owned flag carrier and a member of Star Alliance.",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🇪🇬 Egypt"
      },
      {
        "cls": "tag-blue",
        "label": "Star Alliance"
      },
      {
        "cls": "tag-gray",
        "label": "FSC"
      },
      {
        "cls": "tag-orange",
        "label": "Africa & Middle East"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "~70",
        "label": "Fleet Size"
      },
      {
        "val": "75+ cities",
        "label": "Destination Cities"
      }
    ],
    "overview": [
      "Founded in 1932, EgyptAir is one of the oldest airlines in the world. From its hub in Cairo it serves Europe, Asia, Africa and North America, and it is a member of Star Alliance. The Egyptian pound (EGP) has continued to fall sharply, and as a result the real value of pay under local contracts has declined. Foreign pilots are in some cases hired on <strong>special USD-denominated contracts</strong>. The fleet is built around the B787, A220 and B737."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Cairo, Egypt"
      },
      {
        "k": "Hub",
        "v": "Cairo International Airport (CAI)"
      },
      {
        "k": "Alliance",
        "v": "Star Alliance"
      },
      {
        "k": "Founded",
        "v": "1932"
      },
      {
        "k": "Fleet Size",
        "v": "Approx. 70 aircraft"
      },
      {
        "k": "Income Tax",
        "v": "Yes (top rate 25%)"
      }
    ],
    "salaryNote": "Foreign pilots are typically engaged on USD-denominated contracts, while local crew are paid in a mix of EGP and USD. For local pilots, the real value of EGP-denominated pay continues to erode under currency depreciation. A housing allowance is provided separately. Yen equivalents are converted at USD/JPY = 150.",
    "ops": {
      "routes": "From the Cairo hub, EgyptAir serves Europe (London, Paris, Frankfurt and others), North America (New York, Los Angeles and others), Asia (Tokyo, Beijing, Bangkok and others), as well as destinations across Africa and the Middle East.",
      "fleet": "Boeing 787-9, B737-800, Airbus A220-300, A320/A321neo. Approximately 70 aircraft."
    },
    "training": [
      {
        "title": "Type Rating Training (ICAO Standards)",
        "body": "Type rating training is conducted at facilities approved by the Egyptian Civil Aviation Authority (ECAA) or at OEM training centers."
      },
      {
        "title": "LIFUS",
        "body": "Line training follows once the type rating is obtained."
      },
      {
        "title": "Recurrent Checks",
        "body": "OPC/LPC once or twice a year, in accordance with ICAO Annex 1/6."
      },
      {
        "title": "Upgrade to Captain",
        "body": "Upgrade to Captain is filled primarily through in-house progression, and EgyptAir also has a track record of hiring foreign captains directly."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Staff Travel",
        "body": "Discounted or free tickets for the pilot and family. Partner carriers, including Star Alliance members, can also be used."
      },
      {
        "icon": "🏥",
        "title": "Medical Insurance",
        "body": "Medical cover for the pilot and family."
      },
      {
        "icon": "🌍",
        "title": "Expatriate Allowances",
        "body": "Housing allowance and cost-of-living support for foreign pilots. USD-denominated contracts are common."
      },
      {
        "icon": "📅",
        "title": "Paid Leave",
        "body": "20–30 days per year. Crew on long-haul routes also receive recovery days."
      }
    ],
    "hiringStatus": "EgyptAir has a track record of hiring foreign pilots. Candidates holding a B787 or A320-family type rating are given preference.",
    "hiringColor": "#f5c842",
    "jobs": [
      {
        "title": "Captain / First Officer (Foreign Pilot Hiring)",
        "sub": "International operations. Cairo-based.",
        "status": "Ad-hoc recruitment",
        "statusTag": "blue",
        "details": [
          {
            "k": "License",
            "v": "ATPL (ICAO-compliant, ECAA-approved)"
          },
          {
            "k": "English",
            "v": "ICAO Level 4 or above"
          },
          {
            "k": "Min. Flight Hours",
            "v": "Captain 4,500h+ (guideline)"
          },
          {
            "k": "Contract",
            "v": "Fixed-term contract (2–3 years)"
          }
        ],
        "note": "Cairo has a low cost of living, so USD-denominated income carries high real purchasing power. The tourism and cultural environment is another draw."
      }
    ],
    "recruitUrl": "https://www.egyptair.com/en/about-egyptair/careers/Pages/default.aspx"
  },
  {
    "file": "ethiopian-airlines.html",
    "code": "ET",
    "color": "#EFC050",
    "nameEn": "Ethiopian Airlines",
    "subtitle": "Ethiopian Airlines — Africa's largest airline and a Star Alliance member.",
    "tags": [
      {
        "cls": "tag-gold",
        "label": "🇪🇹 Ethiopia"
      },
      {
        "cls": "tag-blue",
        "label": "Star Alliance"
      },
      {
        "cls": "tag-gray",
        "label": "FSC"
      },
      {
        "cls": "tag-green",
        "label": "No.1 in Africa"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "Approx. 140",
        "label": "Fleet Size"
      },
      {
        "val": "130+ cities",
        "label": "Destinations"
      }
    ],
    "overview": [
      "Ethiopian Airlines is the largest airline in Africa. From its hub in Addis Ababa it serves more than 130 cities worldwide, and its intra-Africa network is also one of the largest on the continent. The carrier is a member of Star Alliance. Through its own Aviation Academy it trains large numbers of pilots and engineers, so a high proportion of its pilots and engineers are trained in-house. Foreign pilots are employed under special USD-denominated contracts. The airline operates a large fleet of latest-generation aircraft including the B787, B777 and B737 MAX."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Addis Ababa, Ethiopia"
      },
      {
        "k": "Hub",
        "v": "Bole International Airport (ADD)"
      },
      {
        "k": "Alliance",
        "v": "Star Alliance"
      },
      {
        "k": "Founded",
        "v": "1945"
      },
      {
        "k": "Fleet Size",
        "v": "Approx. 140 aircraft"
      },
      {
        "k": "Income Tax",
        "v": "Foreign nationals: to be confirmed"
      }
    ],
    "salaryNote": "JPY equivalents are converted at USD/JPY = 150. Foreign pilots are normally engaged on USD-denominated contracts paid as a monthly salary, with housing allowance, medical insurance and home-leave air tickets provided separately. The cost of living in Ethiopia is low, so real purchasing power is comparatively high.",
    "ops": {
      "routes": "From the Addis Ababa hub the airline serves Europe (London, Frankfurt, Paris and others), North America (New York, Washington, Houston and others), Asia (Beijing, Tokyo, Shanghai and others) and destinations right across Africa (more than 60 cities).",
      "fleet": "Boeing 787-8/9, B777-200LR/F, B737 MAX 8/9, Airbus A350-900. Approximately 140 aircraft."
    },
    "training": [
      {
        "title": "Type Rating Training (ICAO standards)",
        "body": "Type rating training is conducted at facilities approved by the relevant national civil aviation authorities (ECAA / SACAA / KCAA, etc.) or at OEM training centres."
      },
      {
        "title": "LIFUS",
        "body": "Line training is carried out after the type rating is obtained. Ethiopian Airlines operates its own in-house training centre (the Aviation Academy)."
      },
      {
        "title": "Recurrent Checks",
        "body": "OPC/LPC once or twice a year, in accordance with ICAO Annex 1/6."
      },
      {
        "title": "Upgrade to Captain",
        "body": "At Ethiopian Airlines, in-house cadet training is the main pipeline. Carriers such as those in Kenya and South Africa have a track record of hiring foreign Captains directly."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Staff Travel",
        "body": "Discounted or free air tickets for the pilot and family. Tickets can also be used on partner carriers, including Star Alliance members (Ethiopia)."
      },
      {
        "icon": "🏥",
        "title": "Medical Insurance",
        "body": "Medical insurance for the pilot and family. Coverage in Ethiopia and South Africa is relatively comprehensive."
      },
      {
        "icon": "🌍",
        "title": "Expatriate Allowance",
        "body": "Housing allowance and cost-of-living support for foreign pilots. USD-denominated contracts are common."
      },
      {
        "icon": "📅",
        "title": "Paid Leave",
        "body": "20–30 days per year, inclusive of recovery leave for crew flying long-haul routes."
      }
    ],
    "hiringStatus": "Foreign Captains and First Officers have been hired. Holders of B787/B777/A350 type ratings are given preference.",
    "hiringColor": "#34d399",
    "jobs": [
      {
        "title": "Captain / First Officer (Foreign Pilot Recruitment)",
        "sub": "International operations. Addis Ababa base.",
        "status": "Now Hiring",
        "statusTag": "green",
        "details": [
          {
            "k": "License",
            "v": "ATPL (ICAO-compliant)"
          },
          {
            "k": "English",
            "v": "ICAO Level 4 or above"
          },
          {
            "k": "Minimum Flight Hours",
            "v": "Captain 5,000h+"
          },
          {
            "k": "Contract",
            "v": "Fixed-term contract (2–3 years), USD-denominated"
          }
        ],
        "note": "Type rating training can be completed at the Aviation Academy. Foreign hires work alongside the airline's own cadet-trained pilots."
      }
    ],
    "recruitUrl": "https://www.ethiopianairlines.com/aa/about-us/careers"
  },
  {
    "file": "kenya-airways.html",
    "code": "KQ",
    "color": "#CC0000",
    "nameEn": "Kenya Airways",
    "subtitle": "Kenya Airways — Kenya's flag carrier, known as 'The Pride of Africa'",
    "tags": [
      {
        "cls": "tag-red",
        "label": "🇰🇪 Kenya"
      },
      {
        "cls": "tag-blue",
        "label": "SkyTeam"
      },
      {
        "cls": "tag-gray",
        "label": "FSC"
      },
      {
        "cls": "tag-orange",
        "label": "Africa"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "~40",
        "label": "Fleet Size"
      },
      {
        "val": "50+ cities",
        "label": "Destinations"
      }
    ],
    "overview": [
      "Kenya Airways is the flag carrier of Kenya, known for its catchphrase <strong>\"The Pride of Africa\"</strong>. Operating from its hub in Nairobi, it serves destinations across Africa, Europe and Asia, and is a member of SkyTeam. The airline has a track record of hiring foreign pilots on special USD-denominated contracts. It operates a modern fleet built around the B787 and B737. Despite ongoing financial challenges, recruitment continues."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Nairobi, Kenya"
      },
      {
        "k": "Hub",
        "v": "Jomo Kenyatta International Airport (NBO)"
      },
      {
        "k": "Alliance",
        "v": "SkyTeam"
      },
      {
        "k": "Founded",
        "v": "1977"
      },
      {
        "k": "Fleet",
        "v": "Approx. 40 aircraft"
      },
      {
        "k": "Income Tax",
        "v": "Foreign nationals: check with the airline"
      }
    ],
    "salaryNote": "Captains are engaged on special USD-denominated contracts; First Officers are typically paid in a combination of Kenyan shillings (KES) and USD. Yen equivalents on this site are converted at USD/JPY = 150. The cost of living in Nairobi is low, so real purchasing power is comparatively high. Please check the official recruitment page for the latest terms and conditions.",
    "ops": {
      "routes": "From its Nairobi hub, Kenya Airways serves more than 40 cities within Africa, plus Europe (London, Paris, Amsterdam and others), Asia (Bangkok, Guangzhou and others) and the Middle East (Dubai and others).",
      "fleet": "Boeing 787-8, B737-800/MAX 8. Approximately 40 aircraft."
    },
    "training": [
      {
        "title": "Type Rating Training (ICAO standard)",
        "body": "Type rating training is conducted at facilities approved by the relevant national civil aviation authority (ECAA / SACAA / KCAA, etc.) or at OEM training centers."
      },
      {
        "title": "LIFUS",
        "body": "Line training is carried out after the type rating is obtained. Ethiopian Airlines operates its own in-house training center (Aviation Academy)."
      },
      {
        "title": "Recurrent Checks",
        "body": "OPC/LPC once or twice a year, in accordance with ICAO Annex 1/6."
      },
      {
        "title": "Upgrade to Captain",
        "body": "Ethiopian Airlines relies mainly on in-house cadet development, while carriers such as Kenya Airways and South African operators have a track record of hiring foreign Captains directly."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Staff Travel",
        "body": "Discounted or free tickets for the employee and their family. Partner airlines, including Star Alliance carriers, can also be used (Ethiopian)."
      },
      {
        "icon": "🏥",
        "title": "Medical Insurance",
        "body": "Medical insurance for the employee and their family. Coverage is relatively generous at Ethiopian and South African carriers."
      },
      {
        "icon": "🌍",
        "title": "Expatriate Allowances",
        "body": "Housing allowance and cost-of-living support for foreign pilots. Contracts are commonly USD-denominated."
      },
      {
        "icon": "📅",
        "title": "Paid Leave",
        "body": "20-30 days per year. Crew flying long-haul routes also receive recovery days."
      }
    ],
    "hiringStatus": "There is a track record of hiring foreign Captains and First Officers. Holders of a B787 or B737 type rating are preferred.",
    "hiringColor": "#f5c842",
    "jobs": [
      {
        "title": "Captain / First Officer (Foreign National Recruitment)",
        "sub": "International operations. Nairobi-based.",
        "status": "Irregular hiring",
        "statusTag": "blue",
        "details": [
          {
            "k": "Required License",
            "v": "ATPL (ICAO-compliant)"
          },
          {
            "k": "English",
            "v": "ICAO Level 4 or above"
          },
          {
            "k": "Minimum Flight Hours",
            "v": "Captain: 4,500h or more (guideline)"
          },
          {
            "k": "Contract",
            "v": "Fixed-term contract (2-3 years), USD-denominated"
          }
        ],
        "note": "Nairobi is a business hub for Africa and offers a well-developed living environment."
      }
    ],
    "recruitUrl": "https://www.kenya-airways.com/about-us/careers/"
  },
  {
    "file": "south-african-airways.html",
    "code": "SAA",
    "color": "#006BA6",
    "nameEn": "South African Airways (SAA)",
    "subtitle": "South African Airways — South Africa's state-owned flag carrier · Star Alliance member",
    "tags": [
      {
        "cls": "tag-blue",
        "label": "🇿🇦 South Africa"
      },
      {
        "cls": "tag-blue",
        "label": "Star Alliance"
      },
      {
        "cls": "tag-gray",
        "label": "FSC"
      },
      {
        "cls": "tag-orange",
        "label": "Africa"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "~25 aircraft",
        "label": "Fleet Size"
      },
      {
        "val": "50+",
        "label": "Destinations Served"
      }
    ],
    "overview": [
      "South African Airways (SAA) is South Africa's state-owned flag carrier, founded in <strong>1934</strong>. Operating from its Johannesburg hub, it serves Europe, Asia, North America and destinations across Africa. The airline went through business rescue (bankruptcy protection) proceedings in 2020 and relaunched in 2021. It is a member of Star Alliance. Because salaries are paid in ZAR (South African rand), they are exposed to exchange-rate movements. The airline currently operates at a reduced scale, and hiring is limited."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Johannesburg, South Africa"
      },
      {
        "k": "Hub",
        "v": "O.R. Tambo International Airport (JNB)"
      },
      {
        "k": "Alliance",
        "v": "Star Alliance"
      },
      {
        "k": "Founded",
        "v": "1934"
      },
      {
        "k": "Fleet",
        "v": "Approx. 25 aircraft (rebuilding)"
      },
      {
        "k": "Income Tax",
        "v": "Yes (top rate 45%)"
      }
    ],
    "salaryNote": "Pay is denominated in ZAR (South African rand) and quoted pre-tax, so the yen-converted value swings significantly with the exchange rate (a ZAR/JPY rate of roughly 8 is used as a reference and fluctuates). South Africa levies income tax at a top marginal rate of 45%. Hiring and package conditions have remained in flux since the 2021 restructuring.",
    "ops": {
      "routes": "From the Johannesburg hub, SAA operates international services to London, Frankfurt, Mumbai, Hong Kong and other cities, together with an intra-Africa network (Nairobi, Lusaka, Harare and more). It also flies a substantial number of domestic routes.",
      "fleet": "Airbus A330-200/-300 and Boeing 737-800. Approximately 25 aircraft (fleet rebuilding in progress)."
    },
    "training": [
      {
        "title": "Type Rating Training (ICAO standards)",
        "body": "Type rating training is conducted at facilities approved by the relevant national civil aviation authority (SACAA — the South African Civil Aviation Authority) or at OEM training centres."
      },
      {
        "title": "LIFUS",
        "body": "Line training is flown once the type rating is obtained, with an instructor captain on board until release to the line."
      },
      {
        "title": "Recurrent Checks",
        "body": "OPC/LPC checks one to two times per year, in compliance with ICAO Annex 1/6."
      },
      {
        "title": "FO-to-Captain Upgrade",
        "body": "South African Airways has a track record of hiring foreign captains directly, alongside internal First Officer-to-Captain upgrades."
      }
    ],
    "benefits": [
      {
        "icon": "✈️",
        "title": "Staff Travel",
        "body": "Discounted tickets for the employee and family members. Also usable on Star Alliance member airlines."
      },
      {
        "icon": "🏥",
        "title": "Medical Insurance",
        "body": "Medical cover for the employee and family (South Africa's private medical scheme system)."
      },
      {
        "icon": "📅",
        "title": "Paid Leave",
        "body": "20–25 days per year, in line with South African labour law."
      },
      {
        "icon": "💰",
        "title": "Retirement Pension",
        "body": "A defined-contribution pension scheme is provided."
      }
    ],
    "hiringStatus": "Hiring has been limited since the 2021 restructuring. Check the official website for the latest information.",
    "hiringColor": "#6b7d93",
    "jobs": [
      {
        "title": "Captain / First Officer (Regular Recruitment)",
        "sub": "International and domestic operations. Johannesburg-based.",
        "status": "Confirm on Official Site",
        "statusTag": "gray",
        "details": [
          {
            "k": "License Required",
            "v": "ATPL (ICAO-compliant / SACAA approved)"
          },
          {
            "k": "English",
            "v": "ICAO Level 4 or above"
          },
          {
            "k": "Minimum Flight Hours",
            "v": "Captain: 4,000h or more (guideline)"
          },
          {
            "k": "Type Rating",
            "v": "A330 or B737 preferred"
          }
        ],
        "note": "Recruitment resumed after the 2020–2021 business rescue process. Be sure to confirm the current situation on the official website."
      }
    ],
    "recruitUrl": "https://www.flysaa.com/about-us/careers"
  },
  {
    "file": "kuwait-airways.html",
    "code": "KAC",
    "color": "#007A3D",
    "nameEn": "Kuwait Airways",
    "subtitle": "Kuwait Airways — Kuwait's state-owned flag carrier, based in an oil-producing nation.",
    "tags": [
      {
        "cls": "tag-green",
        "label": "🇰🇼 Kuwait"
      },
      {
        "cls": "tag-gray",
        "label": "FSC"
      },
      {
        "cls": "tag-gold",
        "label": "Tax-Free"
      },
      {
        "cls": "tag-blue",
        "label": "Middle East"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "~25",
        "label": "Fleet Size"
      },
      {
        "val": "40+",
        "label": "Destinations"
      }
    ],
    "overview": [
      "Kuwait Airways is Kuwait's state-owned flag carrier, founded in 1954. From its hub in Kuwait City it serves the Middle East, Europe and Asia. Kuwait levies zero personal income tax, and backed by oil revenues the package offered to foreign pilots is high even by Middle Eastern standards. The airline operates a modern fleet built around the A330 and the A320 family. Fleet modernization is ongoing, and the carrier continues to recruit foreign pilots."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Kuwait City, Kuwait"
      },
      {
        "k": "Hub",
        "v": "Kuwait International Airport (KWI)"
      },
      {
        "k": "Alliance",
        "v": "None"
      },
      {
        "k": "Founded",
        "v": "1954"
      },
      {
        "k": "Fleet",
        "v": "Approx. 25 aircraft"
      },
      {
        "k": "Income Tax",
        "v": "None (tax-free)"
      }
    ],
    "salaryNote": "Figures are converted at USD/JPY = 150. Kuwait imposes zero personal income tax, so pay is effectively take-home. Compensation is denominated in USD. Housing, family medical insurance and home-leave air tickets are provided separately, on top of pay. All compensation shown on this page is a reference value based on publicly available data and prevailing industry levels; confirm actual terms directly with the airline's own recruitment materials.",
    "ops": {
      "routes": "From the Kuwait City hub the airline serves Europe (London, Paris, Frankfurt and others), Asia (Bangkok, Manila, Cairo and others) and destinations within the Middle East region.",
      "fleet": "Airbus A330-200/800neo, A320neo, A321neo. Approximately 25 aircraft."
    },
    "training": [
      {
        "title": "Type Rating Training (EASA / GCAA / GACA approved)",
        "body": "The type rating is obtained at an ATO approved by EASA or by a national civil aviation authority such as those of the UAE, Saudi Arabia or Qatar. The sequence runs ground school → simulator → LIFUS."
      },
      {
        "title": "LIFUS (Line Training)",
        "body": "After the type rating is issued, Line Flying Under Supervision is conducted with an instructor captain on board. Typically around 50 to 80 sectors."
      },
      {
        "title": "Recurrent Checks (OPC / LPC)",
        "body": "Proficiency checks are conducted once or twice a year. They follow ICAO standards and are overseen by each country's civil aviation authority."
      },
      {
        "title": "Upgrade to Captain",
        "body": "Upgrade is either seniority-based or merit-based. Middle Eastern full-service carriers place weight on flight hours and internal assessment. There is a substantial track record of hiring foreign captains."
      }
    ],
    "benefits": [
      {
        "icon": "🌴",
        "title": "Tax-Free Income",
        "body": "The UAE, Saudi Arabia, Bahrain, Kuwait, Oman and other countries in the region levy zero income tax. What you take home is your annual pay."
      },
      {
        "icon": "🏠",
        "title": "Housing Allowance",
        "body": "Company-provided accommodation or a housing allowance. In most cases pilots may bring their families."
      },
      {
        "icon": "✈️",
        "title": "Staff Travel",
        "body": "Free or heavily discounted air tickets for the pilot and family members, including on partner airlines."
      },
      {
        "icon": "🏥",
        "title": "Medical Insurance",
        "body": "Comprehensive medical insurance for the pilot and family, including dental. Loss-of-licence insurance is also standard."
      },
      {
        "icon": "🚗",
        "title": "Transport & Commuting",
        "body": "A pick-up and drop-off service between the airport and home, or a transport allowance."
      },
      {
        "icon": "💰",
        "title": "Bonus",
        "body": "Performance-linked or contract bonuses. Some are paid twice a year."
      }
    ],
    "hiringStatus": "Recruiting foreign Captains and First Officers. Holders of an A330 or A320 type rating are preferred.",
    "hiringColor": "#34d399",
    "jobs": [
      {
        "title": "Captain / First Officer (Foreign Pilot Recruitment)",
        "sub": "International line operations. Kuwait City base.",
        "status": "Now Hiring",
        "statusTag": "green",
        "details": [
          {
            "k": "License Required",
            "v": "ATPL (ICAO-compliant)"
          },
          {
            "k": "English",
            "v": "ICAO Level 4 or above"
          },
          {
            "k": "Minimum Flight Hours",
            "v": "Captain: 4,500h or more (guideline)"
          },
          {
            "k": "Type Rating",
            "v": "A330 / A320 family preferred"
          }
        ],
        "note": "Kuwait has a high standard of living and a safe, comfortable residential environment. School fee support for family members is available."
      }
    ],
    "recruitUrl": "https://www.kuwaitairways.com/en/careers"
  },
  {
    "file": "royal-jordanian.html",
    "code": "RJ",
    "color": "#9B111E",
    "nameEn": "Royal Jordanian",
    "subtitle": "Royal Jordanian — flag carrier of the Kingdom of Jordan · oneworld member",
    "tags": [
      {
        "cls": "tag-red",
        "label": "🇯🇴 Jordan"
      },
      {
        "cls": "tag-blue",
        "label": "oneworld"
      },
      {
        "cls": "tag-gray",
        "label": "FSC"
      },
      {
        "cls": "tag-blue",
        "label": "Middle East"
      }
    ],
    "stats": [
      {
        "val": "—",
        "label": "Capt. Avg (pre-tax)"
      },
      {
        "val": "—",
        "label": "FO Avg (pre-tax)"
      },
      {
        "val": "~25 aircraft",
        "label": "Fleet Size"
      },
      {
        "val": "50+ cities",
        "label": "Destination Cities"
      }
    ],
    "overview": [
      "Royal Jordanian is the flag carrier of the Kingdom of Jordan, founded in 1963. From its hub in Amman it serves the Middle East, Europe, North America and Asia, and it is a member of the <strong>oneworld</strong> alliance. Jordan levies income tax (up to 30%), and pay levels are somewhat lower than at other Middle Eastern carriers, though the cost of living is also comparatively low. The airline operates a modern fleet built around the B787 and the A320 family, and it has a track record of hiring foreign pilots."
    ],
    "facts": [
      {
        "k": "Headquarters",
        "v": "Amman, Jordan"
      },
      {
        "k": "Hub",
        "v": "Queen Alia International Airport (AMM)"
      },
      {
        "k": "Alliance",
        "v": "oneworld"
      },
      {
        "k": "Founded",
        "v": "1963"
      },
      {
        "k": "Fleet",
        "v": "Approx. 25 aircraft"
      },
      {
        "k": "Income Tax",
        "v": "Yes (up to 30%)"
      }
    ],
    "salaryNote": "Figures are pre-tax. Captain pay is denominated in USD, while First Officer pay is paid as a combination of Jordanian dinar (JOD) and USD. Jordan's income tax (up to 30%) applies. A housing allowance is provided separately, on top of the pay package. Yen equivalents are converted at USD/JPY = 150.",
    "ops": {
      "routes": "From its Amman hub, Royal Jordanian serves Europe (London, Frankfurt, Paris and others), North America (New York, Chicago, Detroit and others), Asia (Bangkok, Kuala Lumpur and others), and destinations across the Middle East region.",
      "fleet": "Boeing 787-8, Airbus A320/A321. Approximately 25 aircraft."
    },
    "training": [
      {
        "title": "Type Rating Training (EASA / GCAA / GACA approved)",
        "body": "Type rating training at an ATO approved by a national civil aviation authority (UAE, Saudi Arabia, Qatar, etc.) or by EASA. The sequence runs ground school → simulator → LIFUS."
      },
      {
        "title": "LIFUS (Line Training)",
        "body": "After the type rating is issued, Line Flying Under Supervision is conducted with an instructor captain on board. Typically around 50–80 legs."
      },
      {
        "title": "Recurrent Checks (OPC / LPC)",
        "body": "Proficiency checks one to two times per year. Conducted to ICAO standards under the oversight of the relevant national authority."
      },
      {
        "title": "Upgrade to Captain",
        "body": "Either seniority-based or merit-based. Middle Eastern full-service carriers place heavy weight on flight hours and internal assessment. The airline also has an extensive track record of hiring foreign captains."
      }
    ],
    "benefits": [
      {
        "icon": "🏠",
        "title": "Housing Allowance",
        "body": "Company-provided accommodation or a housing allowance. In most cases pilots may be accompanied by their families."
      },
      {
        "icon": "✈️",
        "title": "Staff Travel",
        "body": "Free or heavily discounted tickets for the pilot and family members, including on partner airlines."
      },
      {
        "icon": "🏥",
        "title": "Medical Insurance",
        "body": "Comprehensive medical insurance for the pilot and family, including dental. Loss-of-licence insurance is also standard."
      },
      {
        "icon": "🚗",
        "title": "Transport & Commuting",
        "body": "Airport-to-home transport service or a commuting allowance."
      },
      {
        "icon": "💰",
        "title": "Bonus",
        "body": "Performance-linked or contractual bonuses. Some are paid twice a year."
      },
      {
        "icon": "🏛️",
        "title": "oneworld Privileges",
        "body": "Extensive staff travel and lounge access privileges across oneworld member airlines."
      }
    ],
    "hiringStatus": "Proven track record of hiring foreign pilots. Holders of a B787 or A320 type rating are given preference.",
    "hiringColor": "#f5c842",
    "jobs": [
      {
        "title": "Captain / First Officer (Foreign Pilot Recruitment)",
        "sub": "International operations. Amman-based.",
        "status": "Ad-hoc hiring",
        "statusTag": "blue",
        "details": [
          {
            "k": "License Required",
            "v": "ATPL (ICAO-compliant)"
          },
          {
            "k": "English",
            "v": "ICAO Level 4 or above"
          },
          {
            "k": "Minimum Flight Hours",
            "v": "4,500+ hours as Captain (guideline)"
          },
          {
            "k": "Type Rating",
            "v": "B787 / A320 family preferred"
          }
        ],
        "note": "Amman has a comparatively low cost of living by Middle Eastern standards, and the living environment is good."
      }
    ],
    "recruitUrl": "https://www.rj.com/en/careers"
  }
];
