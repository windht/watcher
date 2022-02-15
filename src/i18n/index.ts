import zhCNJson from "./zh-CN.json";
import enUSJson from "./en-US.json";

export const languages = {
  "zh-CN": zhCNJson,
  "en-US": enUSJson,
};

export const LanguageLabels = {
  "en-US": "English",
  "zh-CN": "中文",
};

export const LanguageOptions = Object.keys(LanguageLabels).map((key) => ({
  key,
  label: (LanguageLabels as any)[key],
}));
