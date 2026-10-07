/**
 * utils/countries.ts
 *
 * Every country's calling code, for the country picker at sign-in. Anyone can
 * sign up with their own number wherever they are; whether rides can be
 * booked or offered there is a separate question (the market registry in
 * utils/region.ts, and services/locationCountry.ts).
 */

import { MARKETS, REGION } from './region';

export interface Country {
  /** ISO 3166-1 alpha-2, e.g. "ZW" */
  code: string;
  name: string;
  /** "+263" */
  dial: string;
}

// code|dial|name. Countries sharing +1 or +7 dial the area code as part of the number.
const RAW = `AF|93|Afghanistan
AL|355|Albania
DZ|213|Algeria
AD|376|Andorra
AO|244|Angola
AG|1|Antigua and Barbuda
AR|54|Argentina
AM|374|Armenia
AU|61|Australia
AT|43|Austria
AZ|994|Azerbaijan
BS|1|Bahamas
BH|973|Bahrain
BD|880|Bangladesh
BB|1|Barbados
BY|375|Belarus
BE|32|Belgium
BZ|501|Belize
BJ|229|Benin
BT|975|Bhutan
BO|591|Bolivia
BA|387|Bosnia and Herzegovina
BW|267|Botswana
BR|55|Brazil
BN|673|Brunei
BG|359|Bulgaria
BF|226|Burkina Faso
BI|257|Burundi
CV|238|Cabo Verde
KH|855|Cambodia
CM|237|Cameroon
CA|1|Canada
CF|236|Central African Republic
TD|235|Chad
CL|56|Chile
CN|86|China
CO|57|Colombia
KM|269|Comoros
CG|242|Congo
CD|243|Congo (DRC)
CR|506|Costa Rica
CI|225|Côte d’Ivoire
HR|385|Croatia
CU|53|Cuba
CY|357|Cyprus
CZ|420|Czechia
DK|45|Denmark
DJ|253|Djibouti
DM|1|Dominica
DO|1|Dominican Republic
EC|593|Ecuador
EG|20|Egypt
SV|503|El Salvador
GQ|240|Equatorial Guinea
ER|291|Eritrea
EE|372|Estonia
SZ|268|Eswatini
ET|251|Ethiopia
FJ|679|Fiji
FI|358|Finland
FR|33|France
GA|241|Gabon
GM|220|Gambia
GE|995|Georgia
DE|49|Germany
GH|233|Ghana
GR|30|Greece
GD|1|Grenada
GT|502|Guatemala
GN|224|Guinea
GW|245|Guinea-Bissau
GY|592|Guyana
HT|509|Haiti
HN|504|Honduras
HK|852|Hong Kong
HU|36|Hungary
IS|354|Iceland
IN|91|India
ID|62|Indonesia
IR|98|Iran
IQ|964|Iraq
IE|353|Ireland
IL|972|Israel
IT|39|Italy
JM|1|Jamaica
JP|81|Japan
JO|962|Jordan
KZ|7|Kazakhstan
KE|254|Kenya
KI|686|Kiribati
KW|965|Kuwait
KG|996|Kyrgyzstan
LA|856|Laos
LV|371|Latvia
LB|961|Lebanon
LS|266|Lesotho
LR|231|Liberia
LY|218|Libya
LI|423|Liechtenstein
LT|370|Lithuania
LU|352|Luxembourg
MO|853|Macao
MG|261|Madagascar
MW|265|Malawi
MY|60|Malaysia
MV|960|Maldives
ML|223|Mali
MT|356|Malta
MH|692|Marshall Islands
MR|222|Mauritania
MU|230|Mauritius
MX|52|Mexico
FM|691|Micronesia
MD|373|Moldova
MC|377|Monaco
MN|976|Mongolia
ME|382|Montenegro
MA|212|Morocco
MZ|258|Mozambique
MM|95|Myanmar
NA|264|Namibia
NR|674|Nauru
NP|977|Nepal
NL|31|Netherlands
NZ|64|New Zealand
NI|505|Nicaragua
NE|227|Niger
NG|234|Nigeria
KP|850|North Korea
MK|389|North Macedonia
NO|47|Norway
OM|968|Oman
PK|92|Pakistan
PW|680|Palau
PS|970|Palestine
PA|507|Panama
PG|675|Papua New Guinea
PY|595|Paraguay
PE|51|Peru
PH|63|Philippines
PL|48|Poland
PT|351|Portugal
PR|1|Puerto Rico
QA|974|Qatar
RE|262|Réunion
RO|40|Romania
RU|7|Russia
RW|250|Rwanda
KN|1|Saint Kitts and Nevis
LC|1|Saint Lucia
VC|1|Saint Vincent and the Grenadines
WS|685|Samoa
SM|378|San Marino
ST|239|São Tomé and Príncipe
SA|966|Saudi Arabia
SN|221|Senegal
RS|381|Serbia
SC|248|Seychelles
SL|232|Sierra Leone
SG|65|Singapore
SK|421|Slovakia
SI|386|Slovenia
SB|677|Solomon Islands
SO|252|Somalia
ZA|27|South Africa
KR|82|South Korea
SS|211|South Sudan
ES|34|Spain
LK|94|Sri Lanka
SD|249|Sudan
SR|597|Suriname
SE|46|Sweden
CH|41|Switzerland
SY|963|Syria
TW|886|Taiwan
TJ|992|Tajikistan
TZ|255|Tanzania
TH|66|Thailand
TL|670|Timor-Leste
TG|228|Togo
TO|676|Tonga
TT|1|Trinidad and Tobago
TN|216|Tunisia
TR|90|Türkiye
TM|993|Turkmenistan
TV|688|Tuvalu
UG|256|Uganda
UA|380|Ukraine
AE|971|United Arab Emirates
GB|44|United Kingdom
US|1|United States
UY|598|Uruguay
UZ|998|Uzbekistan
VU|678|Vanuatu
VA|39|Vatican City
VE|58|Venezuela
VN|84|Vietnam
YE|967|Yemen
ZM|260|Zambia
ZW|263|Zimbabwe`;

export const COUNTRIES: Country[] = RAW.split('\n').map(line => {
  const [code, dial, name] = line.split('|');
  return { code, name, dial: `+${dial}` };
});

const BY_CODE = new Map(COUNTRIES.map(c => [c.code, c]));

/** The country for an ISO code ("zw" or "ZW"), if known */
export const countryByCode = (code?: string | null): Country | undefined =>
  code ? BY_CODE.get(code.toUpperCase()) : undefined;

/** 🇿🇼 from "ZW" */
export const flagOf = (code: string): string =>
  String.fromCodePoint(...[...code.toUpperCase()].map(ch => 0x1f1e6 + ch.charCodeAt(0) - 65));

/** The market's own country, used when nothing better is known */
export const HOME_COUNTRY: Country = countryByCode(REGION.country) ?? { code: REGION.country, name: REGION.countryName, dial: REGION.dialCode };

/** Whether Siham takes bookings and rides in this country in this build */
export const isServedCountry = (code?: string | null): boolean =>
  !!code && code.toUpperCase() === REGION.country && !!MARKETS[REGION.country];

/**
 * The national digits of a number typed for `country`: spaces, a leading 0
 * and a repeated country code are dropped.
 */
export function nationalDigitsFor(country: Country, input: string): string {
  let digits = input.replace(/\D/g, '');
  const cc = country.dial.slice(1);
  if (digits.length > 9 && digits.startsWith(cc)) digits = digits.slice(cc.length);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

/**
 * The number in E.164, or null when it cannot be a mobile number there. A
 * market's own numbers must match its mobile pattern; elsewhere only the
 * length is checked (E.164: up to 15 digits with the country code).
 */
export function toE164For(country: Country, input: string): string | null {
  const digits = nationalDigitsFor(country, input);
  const market = MARKETS[country.code];
  if (market) return market.mobilePattern.test(digits) ? `${country.dial}${digits}` : null;
  const total = country.dial.length - 1 + digits.length;
  return digits.length >= 6 && total >= 8 && total <= 15 ? `${country.dial}${digits}` : null;
}
