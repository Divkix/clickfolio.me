// Design-sync shim: inert router hooks so components render outside Next.
const router = {
  push: () => {},
  replace: () => {},
  refresh: () => {},
  back: () => {},
  forward: () => {},
  prefetch: () => {},
};
export const useRouter = () => router;
export const usePathname = () => "/dashboard";
export const useSearchParams = () => new URLSearchParams();
export const useParams = () => ({});
export const redirect = () => {};
export const notFound = () => {};
