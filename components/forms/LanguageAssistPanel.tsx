"use client";

type TextFieldTarget = {
  key: string;
  label: string;
  value: string;
};

type LanguageSuggestion = {
  id: string;
  fieldKey: string;
  fieldLabel: string;
  title: string;
  message: string;
  correctedValue?: string;
};

const typoPairs: Array<[RegExp, string, string]> = [
  [/\bwarrenty\b/gi, "warranty", "Spelling"],
  [/\bwaranty\b/gi, "warranty", "Spelling"],
  [/\bcolur\b/gi, "color", "Spelling"],
  [/\bcolour\b/gi, "color", "Marketplace standard"],
  [/\bdiffrent\b/gi, "different", "Spelling"],
  [/\bseprate\b/gi, "separate", "Spelling"],
  [/\brecieve\b/gi, "receive", "Spelling"],
  [/\bgenral\b/gi, "general", "Spelling"],
  [/\bavailabe\b/gi, "available", "Spelling"],
  [/\bavailablee\b/gi, "available", "Spelling"],
  [/\bquntity\b/gi, "quantity", "Spelling"],
  [/\bquantaty\b/gi, "quantity", "Spelling"],
  [/\bdiscription\b/gi, "description", "Spelling"],
  [/\bdecription\b/gi, "description", "Spelling"],
  [/\bcatagory\b/gi, "category", "Spelling"],
  [/\bsubcatagory\b/gi, "subcategory", "Spelling"],
  [/\bpackeging\b/gi, "packaging", "Spelling"],
  [/\bdelivary\b/gi, "delivery", "Spelling"],
  [/\bmanufacter\b/gi, "manufacturer", "Spelling"],
  [/\bmatrial\b/gi, "material", "Spelling"],
  [/\bcompatiblity\b/gi, "compatibility", "Spelling"],
  [/\borginal\b/gi, "original", "Spelling"],
  [/\bbrandeded\b/gi, "branded", "Spelling"],
  [/\bpeice\b/gi, "piece", "Spelling"],
  [/\bpic\b/gi, "piece", "Product wording"],
];

function sentenceCase(value: string) {
  return value.replace(/(^\s*[a-z])|([.!?]\s+[a-z])/g, (match) =>
    match.toUpperCase(),
  );
}

function cleanText(value: string) {
  let next = value.replace(/[ \t]{2,}/g, " ").replace(/\s+\n/g, "\n").trim();
  typoPairs.forEach(([pattern, replacement]) => {
    next = next.replace(pattern, replacement);
  });
  return sentenceCase(next);
}

function getSuggestions(fields: TextFieldTarget[]) {
  const suggestions: LanguageSuggestion[] = [];

  fields.forEach((field) => {
    const value = field.value || "";
    const trimmed = value.trim();
    if (!trimmed) return;

    const correctedValue = cleanText(value);
    if (correctedValue && correctedValue !== value) {
      suggestions.push({
        id: `${field.key}-cleanup`,
        fieldKey: field.key,
        fieldLabel: field.label,
        title: "Clean spelling and spacing",
        message: "Fix common spelling mistakes, extra spaces and sentence casing.",
        correctedValue,
      });
    }

    typoPairs.forEach(([pattern, replacement, title]) => {
      pattern.lastIndex = 0;
      if (pattern.test(value)) {
        suggestions.push({
          id: `${field.key}-${replacement}`,
          fieldKey: field.key,
          fieldLabel: field.label,
          title,
          message: `Use "${replacement}" in ${field.label}.`,
        });
      }
    });

    if (/description|details|fitment|guide|note|policy/i.test(field.label)) {
      if (trimmed.length < 35) {
        suggestions.push({
          id: `${field.key}-short`,
          fieldKey: field.key,
          fieldLabel: field.label,
          title: "Add more detail",
          message:
            "This looks too short. Add material, size, use case, warranty, compatibility or care details.",
        });
      }

      const usefulWords = [
        "material",
        "size",
        "color",
        "warranty",
        "compatible",
        "capacity",
        "weight",
        "pack",
        "return",
      ];
      const hasUsefulDetail = usefulWords.some((word) =>
        trimmed.toLowerCase().includes(word),
      );
      if (!hasUsefulDetail) {
        suggestions.push({
          id: `${field.key}-facts`,
          fieldKey: field.key,
          fieldLabel: field.label,
          title: "Add customer facts",
          message:
            "Mention exact product facts like material, size/capacity, color, compatibility, warranty, pack count or return policy.",
        });
      }
    }

    if (/[a-z]\.[A-Z]/.test(value) || /,[^\s]/.test(value)) {
      suggestions.push({
        id: `${field.key}-punctuation`,
        fieldKey: field.key,
        fieldLabel: field.label,
        title: "Improve punctuation",
        message: "Add spaces after commas and full stops for a professional look.",
        correctedValue: correctedValue.replace(/,([^\s])/g, ", $1").replace(/\.([A-Z])/g, ". $1"),
      });
    }
  });

  return suggestions.filter(
    (suggestion, index, all) =>
      all.findIndex((item) => item.id === suggestion.id) === index,
  );
}

type LanguageAssistPanelProps = {
  title?: string;
  fields: TextFieldTarget[];
  onApply: (fieldKey: string, value: string) => void;
};

export default function LanguageAssistPanel({
  title = "Language Check",
  fields,
  onApply,
}: LanguageAssistPanelProps) {
  const suggestions = getSuggestions(fields).slice(0, 8);

  return (
    <section className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="font-black text-emerald-950">{title}</h4>
          <p className="mt-1 text-xs font-semibold text-emerald-800">
            Finds common language mistakes and improves professional product wording.
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-emerald-700">
          {suggestions.length} issue{suggestions.length === 1 ? "" : "s"}
        </span>
      </div>

      {suggestions.length === 0 ? (
        <p className="mt-4 rounded-xl bg-white p-3 text-xs font-bold text-emerald-700">
          No language issues found in the checked fields.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {suggestions.map((suggestion) => (
            <div key={suggestion.id} className="rounded-xl bg-white p-3 shadow-sm">
              <p className="text-xs font-black uppercase text-emerald-700">
                {suggestion.fieldLabel}
              </p>
              <p className="mt-1 font-black text-slate-950">{suggestion.title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                {suggestion.message}
              </p>
              {suggestion.correctedValue && (
                <button
                  type="button"
                  onClick={() =>
                    onApply(suggestion.fieldKey, suggestion.correctedValue || "")
                  }
                  className="mt-3 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-black text-white"
                >
                  Apply suggested fix
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
