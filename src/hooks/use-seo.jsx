import { useEffect } from "react";

const upsertMetaTag = (selector, attributes) => {
  let tag = document.querySelector(selector);
  if (!tag) {
    tag = document.createElement("meta");
    document.head.appendChild(tag);
  }
  Object.entries(attributes).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      tag.setAttribute(key, value);
    }
  });
};

export function useSEO({
  title,
  description,
  keywords,
  og,
  canonical,
  jsonLd,
  jsonLdId = "schema-local-business",
} = {}) {
  useEffect(() => {
    if (title) {
      document.title = title;
    }

    if (description) {
      upsertMetaTag('meta[name="description"]', {
        name: "description",
        content: description,
      });
    }

    if (keywords) {
      upsertMetaTag('meta[name="keywords"]', {
        name: "keywords",
        content: keywords,
      });
    }

    if (og) {
      Object.entries(og).forEach(([key, value]) => {
        if (!value) return;
        const property = key.startsWith("og:") ? key : `og:${key}`;
        upsertMetaTag(`meta[property="${property}"]`, {
          property,
          content: value,
        });
      });
    }

    if (canonical) {
      let canonicalTag = document.querySelector('link[rel="canonical"]');
      if (!canonicalTag) {
        canonicalTag = document.createElement("link");
        canonicalTag.setAttribute("rel", "canonical");
        document.head.appendChild(canonicalTag);
      }
      canonicalTag.setAttribute("href", canonical);
    }

    if (jsonLd) {
      let scriptTag = document.getElementById(jsonLdId);
      if (!scriptTag) {
        scriptTag = document.createElement("script");
        scriptTag.type = "application/ld+json";
        scriptTag.id = jsonLdId;
        document.head.appendChild(scriptTag);
      }
      scriptTag.textContent = JSON.stringify(jsonLd);
    }
  }, [title, description, keywords, og, canonical, jsonLd, jsonLdId]);
}
