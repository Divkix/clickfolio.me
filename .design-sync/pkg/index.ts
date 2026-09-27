// Design-sync barrel for @clickfolio/ui - the components Claude Design builds with.
// Scope: components/ui (shadcn primitives) + reusable shared app components.
// Excluded on purpose: resume templates, wizard steps, data/API-bound forms, admin charts.

// Must stay first: defines process.env before any component module evaluates.
import "./shims/process-env";

// Primitives (components/ui)
export { Alert, AlertDescription } from "../../components/ui/alert";
export { Badge } from "../../components/ui/badge";
export { Breadcrumb } from "../../components/ui/breadcrumb";
export { Button } from "../../components/ui/button";
export { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
export { CommaArrayInput } from "../../components/ui/comma-array-input";
export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
export { Input } from "../../components/ui/input";
export { Label } from "../../components/ui/label";
export { Progress } from "../../components/ui/progress";
export { SaveIndicator } from "../../components/ui/save-indicator";
export { Separator } from "../../components/ui/separator";
export { Skeleton } from "../../components/ui/skeleton";
export { Toaster } from "../../components/ui/sonner";
// Same sonner instance as Toaster - a design importing "sonner" itself gets a separate store.
export { toast } from "sonner";
export { Switch } from "../../components/ui/switch";
export { Textarea } from "../../components/ui/textarea";

// Brand + chrome
export { Logo } from "../../components/Logo";
export { ThemeProvider } from "../../components/ThemeProvider";
export { ThemeToggle } from "../../components/ThemeToggle";
export { SiteHeader } from "../../components/SiteHeader";
export { Footer } from "../../components/Footer";
export {
  GitHubIcon,
  LinkedInIcon,
  WhatsAppIcon,
  BehanceIcon,
  DribbbleIcon,
} from "./shims/brand-icons";

// Marketing / content
export { FaqAccordion } from "../../components/Faq";
export { ComparisonTable } from "../../components/blog/ComparisonTable";
export { StatsGrid } from "../../components/blog/StatsGrid";
export { PostSection, PostList } from "../../components/blog/PostSection";
export { LinkedInExportHelp } from "../../components/LinkedInExportHelp";
export { FileDropzone } from "../../components/FileDropzone";

// Sharing + viewer widgets
export { ShareBar } from "../../components/ShareBar";
export { SharePopover } from "../../components/SharePopover";
export { CopyLinkButton } from "../../components/dashboard/CopyLinkButton";
export { AttributionWidget } from "../../components/AttributionWidget";
export { CreateYoursCTA } from "../../components/CreateYoursCTA";
export { YouAreLiveModal } from "../../components/YouAreLiveModal";

// App building blocks
export { WizardProgress } from "../../components/wizard/WizardProgress";
export { FormSectionCard } from "../../components/forms/FormSectionCard";
export { StatCard } from "../../components/admin/StatCard";
export { HorizontalBarChart } from "../../components/admin/HorizontalBarChart";
export { Pagination } from "../../components/admin/Pagination";
export { ResumeStatusBadge } from "../../components/admin/ResumeStatusBadge";
export { UserStatusBadge } from "../../components/admin/UserStatusBadge";
export { PersonCard } from "../../components/explore/person-card";
export { NoResults } from "../../components/explore/no-results";
export { ExploreHeader } from "../../components/explore/explore-header";

// Icons: lucide-react subset as a namespace (one catalog card, not one card per glyph)
export * as Icons from "./icons";
