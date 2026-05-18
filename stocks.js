// NSE F&O Stocks List (Updated 2025)
// Sourced from SEBI/NSE derivatives segment
// Yahoo Finance uses .NS suffix for NSE-listed stocks

const FNO_STOCKS = [
  // Banking & Financial Services
  { symbol: "HDFCBANK",     name: "HDFC Bank",                 sector: "Banking" },
  { symbol: "ICICIBANK",    name: "ICICI Bank",                sector: "Banking" },
  { symbol: "SBIN",         name: "State Bank of India",       sector: "Banking" },
  { symbol: "AXISBANK",     name: "Axis Bank",                 sector: "Banking" },
  { symbol: "KOTAKBANK",    name: "Kotak Mahindra Bank",       sector: "Banking" },
  { symbol: "INDUSINDBK",   name: "IndusInd Bank",             sector: "Banking" },
  { symbol: "BANKBARODA",   name: "Bank of Baroda",            sector: "Banking" },
  { symbol: "PNB",          name: "Punjab National Bank",      sector: "Banking" },
  { symbol: "CANBK",        name: "Canara Bank",               sector: "Banking" },
  { symbol: "AUBANK",       name: "AU Small Finance Bank",     sector: "Banking" },
  { symbol: "IDFCFIRSTB",   name: "IDFC First Bank",           sector: "Banking" },
  { symbol: "FEDERALBNK",   name: "Federal Bank",              sector: "Banking" },
  { symbol: "BANDHANBNK",   name: "Bandhan Bank",              sector: "Banking" },
  { symbol: "RBLBANK",      name: "RBL Bank",                  sector: "Banking" },
  { symbol: "BAJFINANCE",   name: "Bajaj Finance",             sector: "Finance" },
  { symbol: "BAJAJFINSV",   name: "Bajaj Finserv",             sector: "Finance" },
  { symbol: "CHOLAFIN",     name: "Cholamandalam Inv & Fin",   sector: "Finance" },
  { symbol: "SHRIRAMFIN",   name: "Shriram Finance",           sector: "Finance" },
  { symbol: "MUTHOOTFIN",   name: "Muthoot Finance",           sector: "Finance" },
  { symbol: "MANAPPURAM",   name: "Manappuram Finance",        sector: "Finance" },
  { symbol: "LICHSGFIN",    name: "LIC Housing Finance",       sector: "Finance" },
  { symbol: "PFC",          name: "Power Finance Corp",        sector: "Finance" },
  { symbol: "RECLTD",       name: "REC Limited",               sector: "Finance" },
  { symbol: "IRFC",         name: "Indian Railway Finance",    sector: "Finance" },
  { symbol: "SBICARD",      name: "SBI Cards & Payment",       sector: "Finance" },
  { symbol: "HDFCAMC",      name: "HDFC AMC",                  sector: "Finance" },
  { symbol: "HDFCLIFE",     name: "HDFC Life Insurance",       sector: "Insurance" },
  { symbol: "SBILIFE",      name: "SBI Life Insurance",        sector: "Insurance" },
  { symbol: "ICICIPRULI",   name: "ICICI Prudential Life",     sector: "Insurance" },
  { symbol: "ICICIGI",      name: "ICICI Lombard General",     sector: "Insurance" },
  { symbol: "LICI",         name: "Life Insurance Corp",       sector: "Insurance" },
  { symbol: "BSE",          name: "BSE Limited",               sector: "Finance" },
  { symbol: "CDSL",         name: "Central Depository",        sector: "Finance" },
  { symbol: "ANGELONE",     name: "Angel One",                 sector: "Finance" },
  { symbol: "POLICYBZR",    name: "PB Fintech",                sector: "Finance" },
  { symbol: "PAYTM",        name: "One 97 Communications",     sector: "Finance" },

  // IT & Technology
  { symbol: "TCS",          name: "Tata Consultancy Services", sector: "IT" },
  { symbol: "INFY",         name: "Infosys",                   sector: "IT" },
  { symbol: "WIPRO",        name: "Wipro",                     sector: "IT" },
  { symbol: "HCLTECH",      name: "HCL Technologies",          sector: "IT" },
  { symbol: "TECHM",        name: "Tech Mahindra",             sector: "IT" },
  { symbol: "LTIM",         name: "LTIMindtree",               sector: "IT" },
  { symbol: "PERSISTENT",   name: "Persistent Systems",        sector: "IT" },
  { symbol: "MPHASIS",      name: "Mphasis",                   sector: "IT" },
  { symbol: "COFORGE",      name: "Coforge",                   sector: "IT" },
  { symbol: "OFSS",         name: "Oracle Financial Services", sector: "IT" },
  { symbol: "TATAELXSI",    name: "Tata Elxsi",                sector: "IT" },
  { symbol: "KPITTECH",     name: "KPIT Technologies",         sector: "IT" },
  { symbol: "ZENSARTECH",   name: "Zensar Technologies",       sector: "IT" },

  // Auto & Auto Components
  { symbol: "MARUTI",       name: "Maruti Suzuki India",       sector: "Auto" },
  { symbol: "M&M",          name: "Mahindra & Mahindra",       sector: "Auto" },
  { symbol: "TATAMOTORS",   name: "Tata Motors",               sector: "Auto" },
  { symbol: "BAJAJ-AUTO",   name: "Bajaj Auto",                sector: "Auto" },
  { symbol: "HEROMOTOCO",   name: "Hero MotoCorp",             sector: "Auto" },
  { symbol: "EICHERMOT",    name: "Eicher Motors",             sector: "Auto" },
  { symbol: "TVSMOTOR",     name: "TVS Motor Company",         sector: "Auto" },
  { symbol: "ASHOKLEY",     name: "Ashok Leyland",             sector: "Auto" },
  { symbol: "BOSCHLTD",     name: "Bosch",                     sector: "Auto" },
  { symbol: "MOTHERSON",    name: "Samvardhana Motherson",     sector: "Auto" },
  { symbol: "BHARATFORG",   name: "Bharat Forge",              sector: "Auto" },
  { symbol: "MRF",          name: "MRF",                       sector: "Auto" },
  { symbol: "BALKRISIND",   name: "Balkrishna Industries",     sector: "Auto" },
  { symbol: "APOLLOTYRE",   name: "Apollo Tyres",              sector: "Auto" },
  { symbol: "EXIDEIND",     name: "Exide Industries",          sector: "Auto" },
  { symbol: "TIINDIA",      name: "Tube Investments",          sector: "Auto" },

  // Oil, Gas & Energy
  { symbol: "RELIANCE",     name: "Reliance Industries",       sector: "Energy" },
  { symbol: "ONGC",         name: "Oil & Natural Gas Corp",    sector: "Energy" },
  { symbol: "IOC",          name: "Indian Oil Corp",           sector: "Energy" },
  { symbol: "BPCL",         name: "Bharat Petroleum",          sector: "Energy" },
  { symbol: "HINDPETRO",    name: "Hindustan Petroleum",       sector: "Energy" },
  { symbol: "GAIL",         name: "GAIL India",                sector: "Energy" },
  { symbol: "PETRONET",     name: "Petronet LNG",              sector: "Energy" },
  { symbol: "IGL",          name: "Indraprastha Gas",          sector: "Energy" },
  { symbol: "MGL",          name: "Mahanagar Gas",             sector: "Energy" },
  { symbol: "GUJGASLTD",    name: "Gujarat Gas",               sector: "Energy" },
  { symbol: "OIL",          name: "Oil India",                 sector: "Energy" },

  // Power & Utilities
  { symbol: "NTPC",         name: "NTPC",                      sector: "Power" },
  { symbol: "POWERGRID",    name: "Power Grid Corp",           sector: "Power" },
  { symbol: "TATAPOWER",    name: "Tata Power",                sector: "Power" },
  { symbol: "ADANIPOWER",   name: "Adani Power",               sector: "Power" },
  { symbol: "ADANIGREEN",   name: "Adani Green Energy",        sector: "Power" },
  { symbol: "ADANIENSOL",   name: "Adani Energy Solutions",    sector: "Power" },
  { symbol: "JSWENERGY",    name: "JSW Energy",                sector: "Power" },
  { symbol: "NHPC",         name: "NHPC",                      sector: "Power" },
  { symbol: "SJVN",         name: "SJVN",                      sector: "Power" },
  { symbol: "TORNTPOWER",   name: "Torrent Power",             sector: "Power" },
  { symbol: "CESC",         name: "CESC",                      sector: "Power" },

  // Metals & Mining
  { symbol: "TATASTEEL",    name: "Tata Steel",                sector: "Metals" },
  { symbol: "JSWSTEEL",     name: "JSW Steel",                 sector: "Metals" },
  { symbol: "HINDALCO",     name: "Hindalco Industries",       sector: "Metals" },
  { symbol: "VEDL",         name: "Vedanta",                   sector: "Metals" },
  { symbol: "JINDALSTEL",   name: "Jindal Steel & Power",      sector: "Metals" },
  { symbol: "SAIL",         name: "Steel Authority",           sector: "Metals" },
  { symbol: "NMDC",         name: "NMDC",                      sector: "Metals" },
  { symbol: "COALINDIA",    name: "Coal India",                sector: "Metals" },
  { symbol: "HINDCOPPER",   name: "Hindustan Copper",          sector: "Metals" },
  { symbol: "NATIONALUM",   name: "National Aluminium",        sector: "Metals" },
  { symbol: "APLAPOLLO",    name: "APL Apollo Tubes",          sector: "Metals" },

  // FMCG & Consumer
  { symbol: "HINDUNILVR",   name: "Hindustan Unilever",        sector: "FMCG" },
  { symbol: "ITC",          name: "ITC",                       sector: "FMCG" },
  { symbol: "NESTLEIND",    name: "Nestle India",              sector: "FMCG" },
  { symbol: "BRITANNIA",    name: "Britannia Industries",      sector: "FMCG" },
  { symbol: "DABUR",        name: "Dabur India",               sector: "FMCG" },
  { symbol: "MARICO",       name: "Marico",                    sector: "FMCG" },
  { symbol: "GODREJCP",     name: "Godrej Consumer",           sector: "FMCG" },
  { symbol: "COLPAL",       name: "Colgate-Palmolive",         sector: "FMCG" },
  { symbol: "TATACONSUM",   name: "Tata Consumer Products",    sector: "FMCG" },
  { symbol: "UBL",          name: "United Breweries",          sector: "FMCG" },
  { symbol: "VBL",          name: "Varun Beverages",           sector: "FMCG" },
  { symbol: "PGHH",         name: "Procter & Gamble Hygiene",  sector: "FMCG" },

  // Pharma & Healthcare
  { symbol: "SUNPHARMA",    name: "Sun Pharmaceutical",        sector: "Pharma" },
  { symbol: "DRREDDY",      name: "Dr. Reddy's Laboratories",  sector: "Pharma" },
  { symbol: "CIPLA",        name: "Cipla",                     sector: "Pharma" },
  { symbol: "DIVISLAB",     name: "Divi's Laboratories",       sector: "Pharma" },
  { symbol: "LUPIN",        name: "Lupin",                     sector: "Pharma" },
  { symbol: "AUROPHARMA",   name: "Aurobindo Pharma",          sector: "Pharma" },
  { symbol: "BIOCON",       name: "Biocon",                    sector: "Pharma" },
  { symbol: "TORNTPHARM",   name: "Torrent Pharmaceuticals",   sector: "Pharma" },
  { symbol: "ALKEM",        name: "Alkem Laboratories",        sector: "Pharma" },
  { symbol: "ZYDUSLIFE",    name: "Zydus Lifesciences",        sector: "Pharma" },
  { symbol: "GLENMARK",     name: "Glenmark Pharmaceuticals",  sector: "Pharma" },
  { symbol: "LAURUSLABS",   name: "Laurus Labs",               sector: "Pharma" },
  { symbol: "GRANULES",     name: "Granules India",            sector: "Pharma" },
  { symbol: "ABBOTINDIA",   name: "Abbott India",              sector: "Pharma" },
  { symbol: "MANKIND",      name: "Mankind Pharma",            sector: "Pharma" },
  { symbol: "APOLLOHOSP",   name: "Apollo Hospitals",          sector: "Healthcare" },
  { symbol: "MAXHEALTH",    name: "Max Healthcare",            sector: "Healthcare" },
  { symbol: "FORTIS",       name: "Fortis Healthcare",         sector: "Healthcare" },
  { symbol: "SYNGENE",      name: "Syngene International",     sector: "Healthcare" },
  { symbol: "IPCALAB",      name: "IPCA Laboratories",         sector: "Pharma" },

  // Cement
  { symbol: "ULTRACEMCO",   name: "UltraTech Cement",          sector: "Cement" },
  { symbol: "GRASIM",       name: "Grasim Industries",         sector: "Cement" },
  { symbol: "SHREECEM",     name: "Shree Cement",              sector: "Cement" },
  { symbol: "AMBUJACEM",    name: "Ambuja Cements",            sector: "Cement" },
  { symbol: "ACC",          name: "ACC",                       sector: "Cement" },
  { symbol: "DALBHARAT",    name: "Dalmia Bharat",             sector: "Cement" },
  { symbol: "RAMCOCEM",     name: "Ramco Cements",             sector: "Cement" },

  // Capital Goods & Infrastructure
  { symbol: "LT",           name: "Larsen & Toubro",           sector: "Infrastructure" },
  { symbol: "SIEMENS",      name: "Siemens",                   sector: "Capital Goods" },
  { symbol: "ABB",          name: "ABB India",                 sector: "Capital Goods" },
  { symbol: "BHEL",         name: "Bharat Heavy Electricals",  sector: "Capital Goods" },
  { symbol: "BEL",          name: "Bharat Electronics",        sector: "Defense" },
  { symbol: "HAL",          name: "Hindustan Aeronautics",     sector: "Defense" },
  { symbol: "CGPOWER",      name: "CG Power & Industrial",     sector: "Capital Goods" },
  { symbol: "CUMMINSIND",   name: "Cummins India",             sector: "Capital Goods" },
  { symbol: "ABBINDIA",     name: "ABB India",                 sector: "Capital Goods" },
  { symbol: "HAVELLS",      name: "Havells India",             sector: "Capital Goods" },
  { symbol: "POLYCAB",      name: "Polycab India",             sector: "Capital Goods" },
  { symbol: "VOLTAS",       name: "Voltas",                    sector: "Consumer Durables" },
  { symbol: "DIXON",        name: "Dixon Technologies",        sector: "Consumer Durables" },
  { symbol: "TITAN",        name: "Titan Company",             sector: "Consumer Durables" },
  { symbol: "ASIANPAINT",   name: "Asian Paints",              sector: "Consumer Durables" },
  { symbol: "BERGEPAINT",   name: "Berger Paints",             sector: "Consumer Durables" },
  { symbol: "PIDILITIND",   name: "Pidilite Industries",       sector: "Chemicals" },
  { symbol: "KAJARIACER",   name: "Kajaria Ceramics",          sector: "Consumer Durables" },
  { symbol: "CROMPTON",     name: "Crompton Greaves",          sector: "Consumer Durables" },
  { symbol: "WHIRLPOOL",    name: "Whirlpool of India",        sector: "Consumer Durables" },

  // Telecom & Media
  { symbol: "BHARTIARTL",   name: "Bharti Airtel",             sector: "Telecom" },
  { symbol: "IDEA",         name: "Vodafone Idea",             sector: "Telecom" },
  { symbol: "INDUSTOWER",   name: "Indus Towers",              sector: "Telecom" },
  { symbol: "ZEEL",         name: "Zee Entertainment",         sector: "Media" },
  { symbol: "SUNTV",        name: "Sun TV Network",            sector: "Media" },
  { symbol: "PVRINOX",      name: "PVR Inox",                  sector: "Media" },

  // Chemicals & Fertilizers
  { symbol: "UPL",          name: "UPL",                       sector: "Chemicals" },
  { symbol: "PIIND",        name: "PI Industries",             sector: "Chemicals" },
  { symbol: "SRF",          name: "SRF",                       sector: "Chemicals" },
  { symbol: "AARTIIND",     name: "Aarti Industries",          sector: "Chemicals" },
  { symbol: "ATUL",         name: "Atul",                      sector: "Chemicals" },
  { symbol: "NAVINFLUOR",   name: "Navin Fluorine",            sector: "Chemicals" },
  { symbol: "DEEPAKNTR",    name: "Deepak Nitrite",            sector: "Chemicals" },
  { symbol: "GNFC",         name: "Gujarat Narmada Valley",    sector: "Chemicals" },
  { symbol: "CHAMBLFERT",   name: "Chambal Fertilisers",       sector: "Fertilizers" },
  { symbol: "COROMANDEL",   name: "Coromandel International",  sector: "Fertilizers" },

  // Real Estate & Construction
  { symbol: "DLF",          name: "DLF",                       sector: "Realty" },
  { symbol: "GODREJPROP",   name: "Godrej Properties",         sector: "Realty" },
  { symbol: "OBEROIRLTY",   name: "Oberoi Realty",             sector: "Realty" },
  { symbol: "PRESTIGE",     name: "Prestige Estates",          sector: "Realty" },
  { symbol: "PHOENIXLTD",   name: "Phoenix Mills",             sector: "Realty" },
  { symbol: "LODHA",        name: "Macrotech Developers",      sector: "Realty" },

  // Adani Group & Conglomerates
  { symbol: "ADANIENT",     name: "Adani Enterprises",         sector: "Conglomerate" },
  { symbol: "ADANIPORTS",   name: "Adani Ports & SEZ",         sector: "Logistics" },

  // Retail & Consumer Services
  { symbol: "TRENT",        name: "Trent",                     sector: "Retail" },
  { symbol: "DMART",        name: "Avenue Supermarts",         sector: "Retail" },
  { symbol: "JUBLFOOD",     name: "Jubilant FoodWorks",        sector: "Retail" },
  { symbol: "NYKAA",        name: "FSN E-Commerce (Nykaa)",    sector: "Retail" },
  { symbol: "ZOMATO",       name: "Eternal (Zomato)",          sector: "Internet" },
  { symbol: "NAUKRI",       name: "Info Edge",                 sector: "Internet" },
  { symbol: "INDIAMART",    name: "IndiaMART InterMESH",       sector: "Internet" },
  { symbol: "IRCTC",        name: "IRCTC",                     sector: "Travel" },
  { symbol: "INDIGO",       name: "InterGlobe Aviation",       sector: "Aviation" },

  // Logistics
  { symbol: "CONCOR",       name: "Container Corp",            sector: "Logistics" },
  { symbol: "DELHIVERY",    name: "Delhivery",                 sector: "Logistics" },

  // Misc / Diversified
  { symbol: "ABCAPITAL",    name: "Aditya Birla Capital",      sector: "Finance" },
  { symbol: "ABFRL",        name: "Aditya Birla Fashion",      sector: "Retail" },
  { symbol: "MFSL",         name: "Max Financial Services",    sector: "Finance" },
  { symbol: "ASTRAL",       name: "Astral",                    sector: "Plastics" },
  { symbol: "SUPREMEIND",   name: "Supreme Industries",        sector: "Plastics" },
  { symbol: "PERSISTENT",   name: "Persistent Systems",        sector: "IT" },
  { symbol: "HUDCO",        name: "HUDCO",                     sector: "Finance" },
  { symbol: "JIOFIN",       name: "Jio Financial Services",    sector: "Finance" },
  { symbol: "ETERNAL",      name: "Eternal Limited",           sector: "Internet" },
  { symbol: "SOLARINDS",    name: "Solar Industries",          sector: "Chemicals" },
  { symbol: "LTF",          name: "L&T Finance",               sector: "Finance" },
  { symbol: "LTTS",         name: "L&T Technology Services",   sector: "IT" },
  { symbol: "NCC",          name: "NCC",                       sector: "Infrastructure" },
  { symbol: "GMRINFRA",     name: "GMR Airports Infra",        sector: "Infrastructure" },
  { symbol: "IRB",          name: "IRB Infrastructure",        sector: "Infrastructure" },
  { symbol: "OFSS",         name: "Oracle Financial Services", sector: "IT" },
  { symbol: "POONAWALLA",   name: "Poonawalla Fincorp",        sector: "Finance" },
  { symbol: "GLAXO",        name: "GlaxoSmithKline Pharma",    sector: "Pharma" },
  { symbol: "PEL",          name: "Piramal Enterprises",       sector: "Finance" },
  { symbol: "VINATIORGA",   name: "Vinati Organics",           sector: "Chemicals" },
  { symbol: "ESCORTS",      name: "Escorts Kubota",            sector: "Auto" },
  { symbol: "TATACOMM",     name: "Tata Communications",       sector: "Telecom" },
  { symbol: "TATACHEM",     name: "Tata Chemicals",            sector: "Chemicals" },
  { symbol: "PAGEIND",      name: "Page Industries",           sector: "Textiles" },

  // Indices (for reference)
];

// Major Indices for benchmark
const INDICES = [
  { symbol: "^NSEI",        name: "NIFTY 50",                  sector: "Index" },
  { symbol: "^NSEBANK",     name: "BANK NIFTY",                sector: "Index" },
];

// Deduplicate by symbol (in case any slipped through)
const SEEN = new Set();
const FNO_STOCKS_UNIQUE = FNO_STOCKS.filter(s => {
  if (SEEN.has(s.symbol)) return false;
  SEEN.add(s.symbol);
  return true;
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FNO_STOCKS: FNO_STOCKS_UNIQUE, INDICES };
}
