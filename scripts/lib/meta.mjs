// サイト全体で使う定数

export const SITE_NAME = '手術件数しらべ';
export const TAGLINE = '病院ごとの手術件数・入院患者数を、国のDPC公開データで';
export const OPERATOR = '合同会社mico';
export const OPERATOR_ID = '8250003003918';
export const CONTACT = 'mico.95.official@gmail.com';

export const SOURCE_NAME = 'DPCの評価・検証等に係る調査「退院患者調査」の結果報告';
export const TREE_NAME = '診断群分類（DPC）電子点数表';
export const CITY_NAME = '全国地方公共団体コード';

export const PREFS = [
  ['01', '北海道', 'hokkaido'], ['02', '青森県', 'aomori'], ['03', '岩手県', 'iwate'], ['04', '宮城県', 'miyagi'],
  ['05', '秋田県', 'akita'], ['06', '山形県', 'yamagata'], ['07', '福島県', 'fukushima'], ['08', '茨城県', 'ibaraki'],
  ['09', '栃木県', 'tochigi'], ['10', '群馬県', 'gunma'], ['11', '埼玉県', 'saitama'], ['12', '千葉県', 'chiba'],
  ['13', '東京都', 'tokyo'], ['14', '神奈川県', 'kanagawa'], ['15', '新潟県', 'niigata'], ['16', '富山県', 'toyama'],
  ['17', '石川県', 'ishikawa'], ['18', '福井県', 'fukui'], ['19', '山梨県', 'yamanashi'], ['20', '長野県', 'nagano'],
  ['21', '岐阜県', 'gifu'], ['22', '静岡県', 'shizuoka'], ['23', '愛知県', 'aichi'], ['24', '三重県', 'mie'],
  ['25', '滋賀県', 'shiga'], ['26', '京都府', 'kyoto'], ['27', '大阪府', 'osaka'], ['28', '兵庫県', 'hyogo'],
  ['29', '奈良県', 'nara'], ['30', '和歌山県', 'wakayama'], ['31', '鳥取県', 'tottori'], ['32', '島根県', 'shimane'],
  ['33', '岡山県', 'okayama'], ['34', '広島県', 'hiroshima'], ['35', '山口県', 'yamaguchi'], ['36', '徳島県', 'tokushima'],
  ['37', '香川県', 'kagawa'], ['38', '愛媛県', 'ehime'], ['39', '高知県', 'kochi'], ['40', '福岡県', 'fukuoka'],
  ['41', '佐賀県', 'saga'], ['42', '長崎県', 'nagasaki'], ['43', '熊本県', 'kumamoto'], ['44', '大分県', 'oita'],
  ['45', '宮崎県', 'miyazaki'], ['46', '鹿児島県', 'kagoshima'], ['47', '沖縄県', 'okinawa'],
].map(([code, name, slug]) => ({ code: +code, name, slug, short: code === '01' ? '北海道' : name.replace(/[都府県]$/, '') }));
export const PREF = new Map(PREFS.map((p) => [p.code, p]));

export const REGIONS = [
  ['北海道・東北', [1, 2, 3, 4, 5, 6, 7]], ['関東', [8, 9, 10, 11, 12, 13, 14]], ['中部', [15, 16, 17, 18, 19, 20, 21, 22, 23]],
  ['近畿', [24, 25, 26, 27, 28, 29, 30]], ['中国・四国', [31, 32, 33, 34, 35, 36, 37, 38, 39]], ['九州・沖縄', [40, 41, 42, 43, 44, 45, 46, 47]],
];

// MDC（主要診断群）。名前は電子点数表のもの、short はふだんの言い方
export const MDC_SHORT = {
  '01': '脳・神経', '02': '目', '03': '耳・鼻・のど', '04': '呼吸器（肺など）', '05': '心臓・血管', '06': '消化器（胃腸・肝臓・胆道・膵臓）',
  '07': '骨・関節・筋肉', '08': '皮膚', '09': '乳房', '10': '内分泌・代謝（糖尿病・甲状腺など）', '11': '腎臓・尿路・男性生殖器',
  '12': '女性生殖器・妊娠・出産', '13': '血液・免疫', '14': '新生児・先天性の病気', '15': '小児の病気', '16': 'けが・やけど・中毒', '17': '精神', '18': 'その他',
};

// 施設の類型（告示番号の頭の数字で決まる）
export const GROUP_INFO = {
  univ: { name: '大学病院本院群', short: '大学病院本院', desc: '大学病院の本院' },
  tokutei: { name: 'DPC特定病院群', short: 'DPC特定病院群', desc: '大学病院本院に準じる診療密度・研修機能などをもつDPC対象病院' },
  hyojun: { name: 'DPC標準病院群', short: 'DPC標準病院群', desc: '大学病院本院群・DPC特定病院群以外のDPC対象病院' },
  junbi: { name: 'DPC準備病院', short: 'DPC準備病院', desc: 'DPC制度への参加を準備している病院（データを提出）' },
  dekidaka: { name: '出来高算定病院', short: '出来高算定病院', desc: 'DPCで支払いを受けていないが、データを提出している病院' },
};
export const GROUP_ORDER = ['univ', 'tokutei', 'hyojun', 'junbi', 'dekidaka'];
