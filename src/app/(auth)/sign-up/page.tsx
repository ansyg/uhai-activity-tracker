import { isGoogleSignInConfigured } from "@/lib/auth/google-config";
import { SignUpForm } from "@/components/auth/SignUpForm";

export default function SignUpPage() {
  return <SignUpForm googleEnabled={isGoogleSignInConfigured()} />;
}
