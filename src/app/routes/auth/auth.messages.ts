import { defineMessages } from '@services/i18n';
import { AUTH_SW } from './auth.messages.sw';

/** The session pages' text: sign in, create an account, forgot and reset password. */
export const AUTH_EN = {
  fields: {
    username: 'Username or email',
    password: 'Password',
    remember: 'Keep me signed in',
    firstName: 'First name',
    lastName: 'Last name',
    email: 'Email',
    newPassword: 'New password',
    confirmPassword: 'Confirm password',
    acceptTerms: 'I agree to the terms of service and the privacy policy',
  },

  /** what a field says when it is left empty or wrong */
  errors: {
    username: 'Enter your username or email',
    password: 'Enter your password',
    firstName: 'Enter your first name',
    lastName: 'Enter your last name',
    email: 'Enter your email',
    acceptTerms: 'Accept the terms to create an account',
    newPassword: 'Choose a password',
    weakPassword: "This password doesn't meet the rules yet",
    confirmPassword: 'Enter the password again',
    mismatch: "Passwords don't match",
  },

  backToSignIn: 'Back to sign in',
  requestNewLink: 'Request a new link',

  login: {
    heading: 'Sign in',
    lead: 'Welcome back — sign in to continue.',
    submit: 'Sign in',
    forgot: 'Forgot password?',
    /** followed by the demo username and password */
    demoAccount: 'Demo account:',
    useDemo: 'Use demo account',
    newHere: 'New here?',
    createAccount: 'Create an account',
  },

  register: {
    heading: 'Create an account',
    lead: "It takes a minute — you'll sign in right after.",
    submit: 'Create account',
    demoNote: "Demo: accounts aren't saved. Afterwards, sign in with the demo account.",
    haveAccount: 'Already have an account?',
    signIn: 'Sign in',
    /** the toast once the account exists */
    ready: 'Your account is ready — sign in to continue.',
  },

  forgot: {
    heading: 'Forgot your password?',
    lead: "Enter the email you signed up with and we'll send you a link to reset it.",
    submit: 'Send reset link',
    sentHeading: 'Check your email',
    /** `{email}` is where the address goes, in bold */
    sent: 'If an account exists for {email}, a link to reset your password is on its way. It may take a few minutes.',
    demoLink: 'Demo: open the reset link',
    resend: 'Resend the link',
    resendIn: (seconds: number) => `Resend the link in ${seconds}s`,
  },

  reset: {
    heading: 'Choose a new password',
    lead: "Use one you don't use anywhere else.",
    submit: 'Reset password',
    badLink: 'This reset link is incomplete or has expired. Links work once, for a limited time.',
    /** the toast once the password is changed */
    done: 'Your password has been reset — sign in with the new one.',
  },

  /** the password rules under a new-password field; the rules themselves are the form's text */
  checklist: {
    label: 'Password requirements',
    // read out after each rule
    met: '(done)',
    unmet: '(not yet)',
  },
};

export type AuthMessages = typeof AUTH_EN;

export const AUTH_MESSAGES = defineMessages('auth', AUTH_EN, { sw: AUTH_SW });
