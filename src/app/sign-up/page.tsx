import { isGoogleSignInConfigured } from "@/lib/auth/google-config";
import { AuthSplitScreen } from "@/components/auth/AuthSplitScreen";
import { SignUpForm } from "@/components/auth/SignUpForm";

export default function SignUpPage() {
  return (
    <AuthSplitScreen heading="Create your account" subheading="Start tracking your implementation work.">
      <SignUpForm googleEnabled={isGoogleSignInConfigured()} />
    </AuthSplitScreen>
  );
}
