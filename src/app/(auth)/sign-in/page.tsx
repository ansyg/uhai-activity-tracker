import { isGoogleSignInConfigured } from "@/lib/auth/google-config";
import { SignInForm } from "@/components/auth/SignInForm";

export default function SignInPage() {
  return <SignInForm googleEnabled={isGoogleSignInConfigured()} />;
}
