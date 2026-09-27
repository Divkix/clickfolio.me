// Design-sync shim: the real BrandIcons load /brand/* from the site root, which doesn't
// exist in Claude Design. Call the real components, then swap the root-relative src for
// the same public/ asset inlined as a data URL (esbuild dataurl loader).
import { cloneElement, type ReactElement } from "react";
import * as Real from "../../../components/icons/BrandIcons";
import githubBlack from "../../../public/brand/github/invertocat-black.svg";
import githubWhite from "../../../public/brand/github/invertocat-white.svg";
import linkedinBlack from "../../../public/brand/linkedin/inbug-black.png";
import linkedinWhite from "../../../public/brand/linkedin/inbug-white.png";

export * from "../../../components/icons/BrandIcons";

const inlined: Record<string, string> = {
  "/brand/github/invertocat-black.svg": githubBlack,
  "/brand/github/invertocat-white.svg": githubWhite,
  "/brand/linkedin/inbug-black.png": linkedinBlack,
  "/brand/linkedin/inbug-white.png": linkedinWhite,
};

function withInlinedSrc<P>(Icon: (props: P) => ReactElement) {
  return function InlinedBrandIcon(props: P) {
    const el = Icon(props) as ReactElement<{ src?: string }>;
    const src = el.props.src;
    return src && inlined[src] ? cloneElement(el, { src: inlined[src] }) : el;
  };
}

export const GitHubIcon = withInlinedSrc(Real.GitHubIcon);
export const LinkedInIcon = withInlinedSrc(Real.LinkedInIcon);
