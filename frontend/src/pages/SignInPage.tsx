import { SignIn } from '@clerk/clerk-react'

export default function SignInPage() {
  return (
    <div className="centered">
      <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" />
    </div>
  )
}
