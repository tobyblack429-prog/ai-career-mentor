"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Locale, translateToChinese } from "@/i18n/translations";

const STORAGE_KEY = "career-mentor-locale";
const TRANSLATABLE_ATTRIBUTES = ["placeholder", "title", "aria-label"] as const;

type LanguageContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (english: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function preserveWhitespace(original: string, translated: string) {
  const leading = original.match(/^\s*/)?.[0] ?? "";
  const trailing = original.match(/\s*$/)?.[0] ?? "";
  return `${leading}${translated}${trailing}`;
}

function isIgnored(node: Node) {
  const element = node.nodeType === Node.ELEMENT_NODE
    ? (node as Element)
    : node.parentElement;
  return Boolean(element?.closest("[data-i18n-ignore], script, style, textarea, pre, code"));
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("zh");
  const textOriginals = useRef(new WeakMap<Text, string>());
  const attributeOriginals = useRef(new WeakMap<Element, Map<string, string>>());
  const hydrationReady = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "zh" || saved === "en") setLocaleState(saved);
  }, []);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    localStorage.setItem(STORAGE_KEY, nextLocale);
  }, []);

  const t = useCallback(
    (english: string) => (locale === "zh" ? translateToChinese(english) : english),
    [locale]
  );

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    document.documentElement.dataset.locale = locale;

    const translateTextNode = (node: Text) => {
      if (isIgnored(node) || !node.data.trim()) return;

      const originals = textOriginals.current;
      const knownOriginal = originals.get(node);

      if (locale === "en") {
        if (knownOriginal !== undefined && node.data !== knownOriginal) node.data = knownOriginal;
        return;
      }

      if (knownOriginal !== undefined) {
        const knownTranslation = preserveWhitespace(
          knownOriginal,
          translateToChinese(knownOriginal.trim())
        );
        // React may reuse a text node and replace its value. Treat that as a new source string.
        if (node.data !== knownTranslation && node.data !== knownOriginal) {
          originals.set(node, node.data);
        }
      } else {
        originals.set(node, node.data);
      }

      const original = originals.get(node) ?? node.data;
      const translated = preserveWhitespace(original, translateToChinese(original.trim()));
      if (translated !== node.data) node.data = translated;
    };

    const translateAttributes = (element: Element) => {
      if (isIgnored(element)) return;
      let originals = attributeOriginals.current.get(element);
      if (!originals) {
        originals = new Map<string, string>();
        attributeOriginals.current.set(element, originals);
      }

      for (const attribute of TRANSLATABLE_ATTRIBUTES) {
        const current = element.getAttribute(attribute);
        if (current === null) continue;
        const knownOriginal = originals.get(attribute);

        if (locale === "en") {
          if (knownOriginal !== undefined && current !== knownOriginal) {
            element.setAttribute(attribute, knownOriginal);
          }
          continue;
        }

        if (knownOriginal === undefined) originals.set(attribute, current);
        const original = originals.get(attribute) ?? current;
        const translated = translateToChinese(original);
        if (translated !== current) element.setAttribute(attribute, translated);
      }
    };

    const scan = (root: Node) => {
      if (root.nodeType === Node.TEXT_NODE) {
        translateTextNode(root as Text);
        return;
      }
      if (root.nodeType !== Node.ELEMENT_NODE || isIgnored(root)) return;

      translateAttributes(root as Element);
      const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT
      );
      let current = walker.nextNode();
      while (current) {
        if (current.nodeType === Node.TEXT_NODE) translateTextNode(current as Text);
        else translateAttributes(current as Element);
        current = walker.nextNode();
      }
    };

    // Next hydrates nested streamed routes after parent effects have started.
    // Delay only the first translation pass so we never mutate server HTML while
    // React is still comparing it. Later user-triggered language changes are fast.
    let observer: MutationObserver | null = null;
    let secondFrame = 0;
    let firstFrame = 0;
    let hydrationTimer = 0;
    const startTranslation = () => {
      firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        scan(document.body);
        observer = new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            if (mutation.type === "characterData") scan(mutation.target);
            mutation.addedNodes.forEach(scan);
          }
        });
        observer.observe(document.body, { childList: true, characterData: true, subtree: true });
      });
      });
    };

    if (hydrationReady.current) {
      startTranslation();
    } else {
      hydrationTimer = window.setTimeout(() => {
        hydrationReady.current = true;
        startTranslation();
      }, 1000);
    }

    return () => {
      clearTimeout(hydrationTimer);
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      observer?.disconnect();
    };
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
      <div className="language-switcher" data-i18n-ignore="true" role="group" aria-label={locale === "zh" ? "语言切换" : "Language switcher"}>
        <span className="language-icon" aria-hidden="true">译</span>
        <button
          type="button"
          className={locale === "zh" ? "active" : ""}
          onClick={() => setLocale("zh")}
          aria-pressed={locale === "zh"}
        >
          中文
        </button>
        <span className="language-divider" aria-hidden="true" />
        <button
          type="button"
          className={locale === "en" ? "active" : ""}
          onClick={() => setLocale("en")}
          aria-pressed={locale === "en"}
        >
          {locale === "zh" ? "英文" : "EN"}
        </button>
      </div>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}
