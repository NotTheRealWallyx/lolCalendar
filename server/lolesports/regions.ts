const REGION_CODES: Record<string, string> = {
  INTERNATIONAL: 'International',
  EMEA: 'EMEA',
  'NORTH AMERICA': 'NA',
  AMERICAS: 'Americas',
  KOREA: 'KR',
  CHINA: 'CN',
  BRAZIL: 'BR',
  JAPAN: 'JP',
  VIETNAM: 'VN',
  OCEANIA: 'OCE',
  PACIFIC: 'APAC',
  'HONG KONG, MACAU, TAIWAN': 'HK/MO/TW',
  'LATIN AMERICA': 'LATAM',
  'LATIN AMERICA NORTH': 'LATAM N',
  'LATIN AMERICA SOUTH': 'LATAM S',
  'COMMONWEALTH OF INDEPENDENT STATES': 'CIS',
}

const toTitleCase = (value: string) =>
  value.toLowerCase().replace(/\b\p{L}/gu, (letter) => letter.toUpperCase())

export const regionCode = (region: string): string => REGION_CODES[region] ?? toTitleCase(region)
