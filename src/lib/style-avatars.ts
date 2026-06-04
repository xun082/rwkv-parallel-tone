/** 与 public/transparent 下 PNG 一一对应，按风格名解析头像路径 */
export const STYLE_AVATAR_FILES = [
  "001-老板.png",
  "002-客户.png",
  "003-同事.png",
  "004-商务邮件.png",
  "005-工作汇报.png",
  "006-伴侣.png",
  "007-父母.png",
  "008-朋友.png",
  "009-老师.png",
  "010-长辈.png",
  "011-孩子.png",
  "012-北京话.png",
  "013-上海话.png",
  "014-粤语.png",
  "015-台湾腔.png",
  "016-四川话.png",
  "017-东北话.png",
  "018-长沙话.png",
  "019-陕西话.png",
  "020-湖北话.png",
  "021-河南话.png",
  "022-山东话.png",
  "023-福建话.png",
  "024-文言文.png",
  "025-鲁迅风格.png",
  "026-古诗词.png",
  "027-武侠风.png",
  "028-莎士比亚.png",
  "029-散文诗.png",
  "030-网络流行语.png",
  "031-二次元.png",
  "032-电竞风格.png",
  "033-直播间.png",
  "034-饭圈用语.png",
  "035-弹幕体.png",
  "036-霸道总裁.png",
  "037-小说旁白.png",
  "038-新闻播报.png",
  "039-诗人.png",
  "040-哲学家.png",
  "041-律师.png",
  "042-医生.png",
  "043-客服.png",
  "044-销售.png",
  "045-幽默搞笑.png",
  "046-讽刺.png",
  "047-委婉含蓄.png",
  "048-记者.png",
  "049-主持人.png",
  "050-程序员.png",
  "051-红楼梦.png",
  "052-三国演义.png",
  "053-西游记.png",
  "054-水浒传.png",
  "055-天津话.png",
  "056-重庆话.png",
  "057-南京话.png",
  "058-客家话.png",
  "059-苏州话.png",
  "060-面向面试官.png",
  "061-会议纪要.png",
  "062-项目复盘.png",
  "063-危机公关.png",
  "064-学术答辩.png",
  "065-科普讲解.png",
  "066-短视频口播.png",
  "067-社媒官宣.png",
  "068-客诉安抚.png",
  "069-电商客服.png",
  "070-旅行攻略.png",
  "071-相亲初聊.png",
  "072-温州话.png",
  "073-南昌话.png",
  "074-昆明话.png",
  "075-兰州话.png",
  "076-朋友圈体.png",
  "077-说明书体.png",
  "078-童话风.png",
  "079-悬疑小说.png",
  "080-治愈系.png",
  "081-饶舌说唱.png",
  "082-美食点评.png",
  "083-纪录片旁白.png",
  "084-播客闲聊.png",
  "085-修仙网文.png",
  "086-翻译腔.png",
  "087-港片台词.png",
] as const;

const avatarByKey = new Map<string, string>();

for (const file of STYLE_AVATAR_FILES) {
  const key = file.replace(/^\d+-/, "").replace(/\.png$/, "");
  avatarByKey.set(key, `/transparent/${file}`);
}

function resolveAvatarKey(styleName: string): string {
  if (styleName.startsWith("面向")) {
    return styleName.slice(2);
  }
  return styleName;
}

export function getStyleAvatarUrl(styleName: string): string {
  const key = resolveAvatarKey(styleName);
  return avatarByKey.get(key) ?? avatarByKey.get(styleName) ?? "/transparent/001-老板.png";
}

export function hasStyleAvatar(styleName: string): boolean {
  const key = resolveAvatarKey(styleName);
  return avatarByKey.has(key) || avatarByKey.has(styleName);
}
