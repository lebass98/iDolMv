//! 아티스트 장르 사전
//!
//! 아이돌차트에는 장르·성별 정보가 없어서 이름(한글·영문 별칭)으로 분류함.
//! 차트에 없는 아티스트도 이 사전으로 목록에 보여 줌 (트로트·힙합 등).
//! 사전에 없는 이름은 "기타"로 분류.

use serde::Serialize;

#[derive(Serialize, Clone, Copy, PartialEq)]
pub enum Genre {
    #[serde(rename = "걸그룹")]
    GirlGroup,
    #[serde(rename = "보이그룹")]
    BoyGroup,
    #[serde(rename = "여자 솔로")]
    FemaleSolo,
    #[serde(rename = "남자 솔로")]
    MaleSolo,
    #[serde(rename = "혼성")]
    Mixed,
    #[serde(rename = "힙합")]
    HipHop,
    #[serde(rename = "트로트")]
    Trot,
    #[serde(rename = "밴드")]
    Band,
    #[serde(rename = "발라드·R&B")]
    Ballad,
    #[serde(rename = "기타")]
    Other,
}

use Genre::*;

/// (한글 표시 이름, 다른 별칭들, 유튜브 검색용 이름, 장르)
const ARTISTS: &[(&str, &[&str], &str, Genre)] = &[
    // ── 걸그룹
    ("에스파", &["aespa"], "aespa", GirlGroup),
    ("뉴진스", &["newjeans"], "NewJeans", GirlGroup),
    ("아이브", &["ive"], "IVE", GirlGroup),
    ("르세라핌", &["lesserafim"], "LE SSERAFIM", GirlGroup),
    ("베이비몬스터", &["babymonster"], "BABYMONSTER", GirlGroup),
    ("트와이스", &["twice"], "TWICE", GirlGroup),
    ("레드벨벳", &["redvelvet"], "Red Velvet", GirlGroup),
    ("블랙핑크", &["blackpink"], "BLACKPINK", GirlGroup),
    ("엔믹스", &["nmixx"], "NMIXX", GirlGroup),
    ("아일릿", &["illit"], "ILLIT", GirlGroup),
    ("아이들", &["여자아이들", "gidle", "idle", "i-dle"], "i-dle", GirlGroup),
    ("있지", &["itzy"], "ITZY", GirlGroup),
    ("키키", &["kiiikiii"], "KiiiKiii", GirlGroup),
    ("하츠투하츠", &["hearts2hearts"], "Hearts2Hearts", GirlGroup),
    ("리센느", &["rescene"], "RESCENE", GirlGroup),
    ("케플러", &["kep1er"], "Kep1er", GirlGroup),
    ("프로미스나인", &["fromis9", "fromis_9"], "fromis_9", GirlGroup),
    ("오마이걸", &["ohmygirl"], "OH MY GIRL", GirlGroup),
    ("마마무", &["mamamoo"], "MAMAMOO", GirlGroup),
    ("소녀시대", &["girlsgeneration", "snsd"], "Girls' Generation", GirlGroup),
    ("스테이씨", &["stayc"], "STAYC", GirlGroup),
    ("트리플에스", &["triples"], "tripleS", GirlGroup),
    ("키스오브라이프", &["kissoflife"], "KISS OF LIFE", GirlGroup),
    ("미야오", &["meovv"], "MEOVV", GirlGroup),
    ("이즈나", &["izna"], "izna", GirlGroup),
    ("영파씨", &["youngposse"], "YOUNG POSSE", GirlGroup),
    ("우주소녀", &["wjsn"], "WJSN", GirlGroup),
    ("에이핑크", &["apink"], "Apink", GirlGroup),
    ("여자친구", &["gfriend"], "GFRIEND", GirlGroup),
    ("비비지", &["viviz"], "VIVIZ", GirlGroup),
    ("빌리", &["billlie"], "Billlie", GirlGroup),
    ("유니스", &["unis"], "UNIS", GirlGroup),
    ("배드빌런", &["badvillain"], "BADVILLAIN", GirlGroup),
    ("드림캐쳐", &["dreamcatcher"], "DREAMCATCHER", GirlGroup),
    ("ITZY", &[], "ITZY", GirlGroup),
    // ── 보이그룹
    ("방탄소년단", &["bts"], "BTS", BoyGroup),
    ("세븐틴", &["seventeen"], "SEVENTEEN", BoyGroup),
    ("스트레이키즈", &["straykids", "skz"], "Stray Kids", BoyGroup),
    ("에이티즈", &["ateez"], "ATEEZ", BoyGroup),
    ("엔시티127", &["nct127"], "NCT 127", BoyGroup),
    ("엔시티드림", &["nctdream"], "NCT DREAM", BoyGroup),
    ("엔시티위시", &["nctwish"], "NCT WISH", BoyGroup),
    ("투모로우바이투게더", &["txt", "tomorrowxtogether"], "TXT", BoyGroup),
    ("엔하이픈", &["enhypen"], "ENHYPEN", BoyGroup),
    ("라이즈", &["riize"], "RIIZE", BoyGroup),
    ("보이넥스트도어", &["boynextdoor"], "BOYNEXTDOOR", BoyGroup),
    ("제로베이스원", &["zerobaseone", "zb1"], "ZEROBASEONE", BoyGroup),
    ("투어스", &["tws"], "TWS", BoyGroup),
    ("코르티스", &["cortis"], "CORTIS", BoyGroup),
    ("더보이즈", &["theboyz"], "THE BOYZ", BoyGroup),
    ("몬스타엑스", &["monstax"], "MONSTA X", BoyGroup),
    ("엑소", &["exo"], "EXO", BoyGroup),
    ("샤이니", &["shinee"], "SHINee", BoyGroup),
    ("빅뱅", &["bigbang"], "BIGBANG", BoyGroup),
    ("트레저", &["treasure"], "TREASURE", BoyGroup),
    ("아스트로", &["astro"], "ASTRO", BoyGroup),
    ("비투비", &["btob"], "BTOB", BoyGroup),
    ("데이식스", &["day6"], "DAY6", Band),
    ("피원하모니", &["p1harmony"], "P1Harmony", BoyGroup),
    ("크래비티", &["cravity"], "CRAVITY", BoyGroup),
    ("엑스디너리히어로즈", &["xdinaryheroes"], "Xdinary Heroes", Band),
    ("킥플립", &["kickflip"], "KickFlip", BoyGroup),
    ("올아워즈", &["allhours"], "ALL(H)OURS", BoyGroup),
    // ── 혼성
    ("올데이프로젝트", &["alldayproject"], "ALLDAY PROJECT", Mixed),
    ("카드", &["kard"], "KARD", Mixed),
    ("악뮤", &["akmu", "악동뮤지션"], "AKMU", Mixed),
    // ── 여자 솔로
    ("아이유", &["iu"], "IU", FemaleSolo),
    ("제니", &["jennie"], "JENNIE", FemaleSolo),
    ("리사", &["lisa"], "LISA", FemaleSolo),
    ("로제", &["rose", "rosé"], "ROSÉ", FemaleSolo),
    ("지수", &["jisoo"], "JISOO", FemaleSolo),
    ("태연", &["taeyeon"], "TAEYEON", FemaleSolo),
    ("소연", &["soyeon", "전소연"], "JEON SOYEON", FemaleSolo),
    ("청하", &["chungha"], "CHUNG HA", FemaleSolo),
    ("화사", &["hwasa"], "HWASA", FemaleSolo),
    ("선미", &["sunmi"], "SUNMI", FemaleSolo),
    ("전소미", &["somi"], "SOMI", FemaleSolo),
    ("권은비", &["kwoneunbi"], "KWON EUN BI", FemaleSolo),
    ("유나", &["yuna"], "YUNA", FemaleSolo),
    ("보아", &["boa"], "BoA", FemaleSolo),
    // ── 남자 솔로
    ("지드래곤", &["gdragon", "gd"], "G-DRAGON", MaleSolo),
    ("태양", &["taeyang"], "TAEYANG", MaleSolo),
    ("정국", &["jungkook"], "Jung Kook", MaleSolo),
    ("지민", &["jimin"], "Jimin", MaleSolo),
    ("뷔", &["v"], "V BTS", MaleSolo),
    ("제이홉", &["jhope"], "j-hope", MaleSolo),
    ("진", &["jin"], "Jin BTS", MaleSolo),
    ("RM", &["알엠"], "RM BTS", MaleSolo),
    ("슈가", &["suga", "agustd"], "Agust D", MaleSolo),
    ("백현", &["baekhyun"], "BAEKHYUN", MaleSolo),
    ("태민", &["taemin"], "TAEMIN", MaleSolo),
    ("키", &["key"], "KEY SHINee", MaleSolo),
    ("우즈", &["woodz"], "WOODZ", MaleSolo),
    ("이찬원", &["leechanwon"], "이찬원", Trot),
    // ── 힙합
    ("지코", &["zico"], "ZICO", HipHop),
    ("박재범", &["jaypark"], "Jay Park", HipHop),
    ("빈지노", &["beenzino"], "Beenzino", HipHop),
    ("이영지", &["youngji", "leeyoungji"], "이영지", HipHop),
    ("비비", &["bibi"], "BIBI", HipHop),
    ("에픽하이", &["epikhigh"], "EPIK HIGH", HipHop),
    ("다이나믹듀오", &["dynamicduo"], "Dynamic Duo", HipHop),
    ("pH-1", &["ph1"], "pH-1", HipHop),
    ("식케이", &["sikk", "sikkoo"], "Sik-K", HipHop),
    ("창모", &["changmo"], "CHANGMO", HipHop),
    ("애쉬아일랜드", &["ashisland"], "ASH ISLAND", HipHop),
    ("빅나티", &["bignaughty"], "BIG Naughty", HipHop),
    ("기리보이", &["giriboy"], "GIRIBOY", HipHop),
    ("비와이", &["bewhy"], "BewhY", HipHop),
    ("로꼬", &["loco"], "Loco", HipHop),
    ("그레이", &["gray"], "GRAY", HipHop),
    ("우원재", &["woowonjae"], "Woo Won Jae", HipHop),
    ("제시", &["jessi"], "Jessi", HipHop),
    ("미란이", &["mirani"], "Mirani", HipHop),
    ("릴보이", &["lilboi"], "lIlBOI", HipHop),
    ("저스디스", &["justhis"], "JUSTHIS", HipHop),
    ("이센스", &["esens"], "E SENS", HipHop),
    // ── 트로트
    ("임영웅", &["limyoungwoong", "imyoungwoong"], "임영웅", Trot),
    ("영탁", &["youngtak"], "영탁", Trot),
    ("송가인", &["songgain"], "송가인", Trot),
    ("장윤정", &["jangyoonjeong"], "장윤정", Trot),
    ("홍진영", &["hongjinyoung"], "홍진영", Trot),
    ("김호중", &["kimhojoong"], "김호중", Trot),
    ("정동원", &["jeongdongwon"], "정동원", Trot),
    ("장민호", &["jangminho"], "장민호", Trot),
    ("김연자", &["kimyeonja"], "김연자", Trot),
    ("박서진", &["parkseojin"], "박서진", Trot),
    ("양지은", &["yangjieun"], "양지은", Trot),
    ("전유진", &["jeonyujin"], "전유진", Trot),
    ("안성훈", &["ansunghoon"], "안성훈", Trot),
    ("박지현", &["parkjihyun"], "박지현 트로트", Trot),
    ("진성", &["jinsung"], "진성 트로트", Trot),
    ("나훈아", &["nahoona"], "나훈아", Trot),
    ("홍지윤", &["hongjiyoon"], "홍지윤", Trot),
    ("김다현", &["kimdahyun"], "김다현", Trot),
    // ── 밴드
    ("QWER", &["qwer"], "QWER", Band),
    ("잔나비", &["jannabi"], "JANNABI", Band),
    ("실리카겔", &["silicagel"], "Silica Gel", Band),
    ("엔플라잉", &["nflying"], "N.Flying", Band),
    ("씨엔블루", &["cnblue"], "CNBLUE", Band),
    ("더로즈", &["therose"], "The Rose", Band),
    ("루시", &["lucy"], "LUCY", Band),
    ("국카스텐", &["guckkasten"], "Guckkasten", Band),
    ("너드커넥션", &["nerdconnection"], "NERD CONNECTION", Band),
    ("검정치마", &["theblackskirts"], "The Black Skirts", Band),
    ("한로로", &["hanroro"], "HANRORO", Band),
    // ── 발라드·R&B
    ("성시경", &["sungsikyung"], "성시경", Ballad),
    ("폴킴", &["paulkim"], "Paul Kim", Ballad),
    ("이무진", &["leemujin"], "이무진", Ballad),
    ("멜로망스", &["melomance"], "MeloMance", Ballad),
    ("10cm", &["십센치", "10센치"], "10CM", Ballad),
    ("크러쉬", &["crush"], "Crush", Ballad),
    ("딘", &["dean"], "DEAN", Ballad),
    ("헤이즈", &["heize"], "Heize", Ballad),
    ("백예린", &["yerinbaek"], "Yerin Baek", Ballad),
    ("태연", &[], "TAEYEON", FemaleSolo),
    ("윤하", &["younha"], "YOUNHA", Ballad),
    ("이하이", &["leehi"], "LEE HI", Ballad),
    ("케이시", &["kassy"], "Kassy", Ballad),
    ("박효신", &["parkhyoshin"], "박효신", Ballad),
    ("임재현", &["limjaehyun"], "임재현", Ballad),
    ("소연", &[], "JEON SOYEON", FemaleSolo),
];

#[derive(Clone)]
pub struct Info {
    pub search_name: &'static str,
    pub genre: Genre,
}

/// 비교용: 소문자 + 공백·기호 제거 (한글은 유지)
fn normalize(s: &str) -> String {
    s.chars()
        .filter(|c| c.is_alphanumeric())
        .flat_map(|c| c.to_lowercase())
        .collect()
}

/// 차트 이름으로 장르·검색 이름 찾기
pub fn lookup(name: &str) -> Option<Info> {
    let key = normalize(name);
    ARTISTS
        .iter()
        .find(|(ko, aliases, en, _)| {
            normalize(ko) == key || normalize(en) == key || aliases.iter().any(|a| normalize(a) == key)
        })
        .map(|(_, _, en, g)| Info { search_name: en, genre: *g })
}

/// 사전 전체 (한글 이름 기준 중복 제거)
pub fn all() -> impl Iterator<Item = (&'static str, &'static str, Genre)> {
    let mut seen = std::collections::HashSet::new();
    ARTISTS
        .iter()
        .filter(move |(ko, ..)| seen.insert(normalize(ko)))
        .map(|(ko, _, en, g)| (*ko, *en, *g))
}

/// 두 이름이 같은 아티스트인지 (차트 이름 ↔ 사전 이름)
pub fn same(a: &str, b: &str) -> bool {
    match (lookup(a), lookup(b)) {
        (Some(x), Some(y)) => x.search_name == y.search_name,
        _ => normalize(a) == normalize(b),
    }
}
