"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
   Form,
   FormControl,
   FormDescription,
   FormField,
   FormItem,
   FormLabel,
   FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
   AlertDialog,
   AlertDialogAction,
   AlertDialogCancel,
   AlertDialogContent,
   AlertDialogDescription,
   AlertDialogFooter,
   AlertDialogHeader,
   AlertDialogTitle,
   AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { PreviewCard } from "@/components/onboarding/preview-card";
import { dateFormats } from "@/lib/config";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { SelectValue } from "@radix-ui/react-select";
import axios from "axios";
import { toast } from "sonner";
import { paths } from "@/lib/paths";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Check, X, Eye, EyeOff } from "lucide-react";

export default function ProfilePage() {
   const { t } = useTranslation();
   const [isDeleting, setIsDeleting] = useState(false);
   const { data: session, update } = useSession();
   const router = useRouter();
   // Preferences form
   const preferencesForm = useForm({
      defaultValues: {
         currency: "USD",
         dateFormat: "MM/DD/YYYY"
      }
   });

   useEffect(() => {
      preferencesForm.setValue("currency", session?.user?.primaryCurrency);
      preferencesForm.setValue("dateFormat", session?.user?.dateFormat);
   }, [session]);

   // Password change form and state
   const [showCurrentPassword, setShowCurrentPassword] = useState(false);
   const [showNewPassword, setShowNewPassword] = useState(false);
   const [showConfirmPassword, setShowConfirmPassword] = useState(false);
   const [strengthText, setStrengthText] = useState("");
   const [strengthColor, setStrengthColor] = useState("red");
   const [passwordCriteria, setPasswordCriteria] = useState({
      length: false,
      lowercase: false,
      uppercase: false,
      special: false
   });
   const [isChangingPassword, setIsChangingPassword] = useState(false);

   const passwordForm = useForm({
      defaultValues: {
         currentPassword: "",
         newPassword: "",
         confirmPassword: ""
      }
   });

   const watchNewPassword = passwordForm.watch("newPassword");
   const watchConfirmPassword = passwordForm.watch("confirmPassword");

   useEffect(() => {
      if (!watchNewPassword) {
         setStrengthText("");
         setStrengthColor("red");
         setPasswordCriteria({
            length: false,
            lowercase: false,
            uppercase: false,
            special: false
         });
         return;
      }

      // Check password criteria
      const criteria = {
         length: watchNewPassword.length >= 8,
         lowercase: /[a-z]/.test(watchNewPassword),
         uppercase: /[A-Z]/.test(watchNewPassword),
         special: /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(watchNewPassword)
      };

      setPasswordCriteria(criteria);

      // Calculate password strength
      let strength = 0;

      // Add 25% for each criterion met
      if (criteria.length) strength += 25;
      if (criteria.lowercase) strength += 25;
      if (criteria.uppercase) strength += 25;
      if (criteria.special) strength += 25;

      // Set text and color based on strength
      if (strength <= 25) {
         setStrengthText(t("auth.passwordWeak"));
         setStrengthColor("red");
      } else if (strength <= 50) {
         setStrengthText(t("auth.passwordFair"));
         setStrengthColor("orange");
      } else if (strength <= 75) {
         setStrengthText(t("auth.passwordGood"));
         setStrengthColor("yellow");
      } else {
         setStrengthText(t("auth.passwordStrong"));
         setStrengthColor("green");
      }
   }, [watchNewPassword, t]);

   // Delete account form
   const deleteForm = useForm({
      defaultValues: {
         confirmDelete: ""
      }
   });

   const onPreferencesSubmit = async (data) => {
      try {
         const response = await axios.post("/api/profile/update-preferences", {
            userId: session?.user?.id,
            dateFormat: data.dateFormat
         });
         if (response.status === 200) {
            toast.success(t("profile.preferencesUpdated"));
            update({
               ...session,
               user: {
                  ...session?.user,
                  dateFormat: data.dateFormat
               }
            });
         }
      } catch (error) {
         toast.error(t("common.errorUpdatingPreferences"));
      }
   };

   const onPasswordSubmit = async (data) => {
      // Validate password meets requirements
      const allCriteriaMet = Object.values(passwordCriteria).every(value => value === true);
      if (!allCriteriaMet) {
         toast.error(t("auth.passwordWeak"));
         return;
      }
      
      // Validate passwords match
      if (data.newPassword !== data.confirmPassword) {
         toast.error(t("auth.passwordsDoNotMatch"));
         return;
      }

      try {
         setIsChangingPassword(true);
         const response = await axios.post("/api/profile/change-password", {
            currentPassword: data.currentPassword,
            newPassword: data.newPassword
         });
         
         if (response.status === 200) {
            toast.success(t("common.passwordUpdated"));
            passwordForm.reset();
         }
      } catch (error) {
         if (error.response?.status === 401) {
            toast.error(t("common.currentPasswordIncorrect"));
         } else {
            toast.error(t("common.passwordUpdateFailed"));
         }
      } finally {
         setIsChangingPassword(false);
      }
   };

   const onDeleteSubmit = async () => {
      try {
         const response = await axios.delete("/api/profile");
         if (response.status === 200) {
            toast.success(t("profile.accountDeleted"));
            await signOut({ callbackUrl: paths.login });
         }
      } catch (error) {
         toast.error(t("common.errorDeletingAccount"));
      }
   };

   // Get watch values for preview card
   const { watch } = preferencesForm;
   const dateFormat = watch("dateFormat");
   const currency = watch("currency");

   return (
      <div className="container mx-auto py-6 space-y-6">
         <Tabs defaultValue="personal" className="w-full">
            <TabsList className="grid w-full md:w-auto grid-cols-3">
               <TabsTrigger value="personal">{t("profile.personalInfo")}</TabsTrigger>
               <TabsTrigger value="security">{t("profile.security")}</TabsTrigger>
               <TabsTrigger value="account">{t("profile.accountManagement")}</TabsTrigger>
            </TabsList>

            {/* Personal Information Tab */}
            <TabsContent value="personal" className="space-y-4 mt-4">
               {/* Personal Info Card */}
               <Card>
                  <CardHeader>
                     <CardTitle>{t("profile.personalInfo")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                     <div className="space-y-4">
                        <div>
                           <div className="text-sm font-medium mb-1.5">{t("common.name")}</div>
                           <div className="px-3 py-2 rounded-md border bg-muted">
                              {session?.user?.name}
                           </div>
                        </div>

                        <div>
                           <div className="text-sm font-medium mb-1.5">{t("common.email")}</div>
                           <div className="px-3 py-2 rounded-md border bg-muted">
                              {session?.user?.email}
                           </div>
                           <p className="text-sm text-muted-foreground mt-1.5">
                              {t("profile.emailChangeNotice")}
                           </p>
                        </div>
                     </div>
                  </CardContent>
               </Card>

               {/* Preferences Card */}
               <Card>
                  <CardHeader>
                     <CardTitle>{t("profile.preferences")}</CardTitle>
                     <CardDescription>{t("profile.preferencesDesc")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                     <div className="grid gap-6 md:grid-cols-2">
                        <div className="space-y-4">
                           <Form {...preferencesForm}>
                              <form onSubmit={preferencesForm.handleSubmit(onPreferencesSubmit)} className="space-y-4">
                                 <div>
                                    <div className="text-sm font-medium mb-1.5">{t("common.currency")}</div>
                                    <div className="px-3 py-2 rounded-md border bg-muted">
                                       {currency}
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-1.5">
                                       {t("profile.currencyChangeNotice")}
                                    </p>
                                 </div>

                                 <FormField
                                    control={preferencesForm.control}
                                    name="dateFormat"
                                    render={({ field }) => (
                                       <FormItem>
                                          <FormLabel>{t("common.dateFormat")}</FormLabel>
                                          <FormControl>
                                             <Select
                                                value={field.value}
                                                onValueChange={field.onChange}
                                             >
                                                <SelectTrigger className="w-full">
                                                   <SelectValue placeholder={t("common.selectDateFormat")} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                   {dateFormats.map((format) => (
                                                      <SelectItem key={format.value} value={format.value}>
                                                         {format.label}
                                                      </SelectItem>
                                                   ))}
                                                </SelectContent>
                                             </Select>
                                          </FormControl>
                                       </FormItem>
                                    )}
                                 />

                                 <Button type="submit" className="w-full md:w-auto">{t("profile.updatePreferences")}</Button>
                              </form>
                           </Form>
                        </div>

                        <div className="flex flex-col">
                           <div className="text-sm font-medium mb-3">{t("onboarding.previewDesc")}</div>
                           <PreviewCard
                              currency={currency}
                              dateFormat={dateFormat}
                           />
                        </div>
                     </div>
                  </CardContent>
               </Card>
            </TabsContent>

            {/* Security Tab */}
            <TabsContent value="security" className="space-y-4 mt-4">
               <Card>
                  <CardHeader>
                     <CardTitle>{t("profile.changePassword")}</CardTitle>
                     <CardDescription>{t("profile.changePasswordDesc")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                     <Form {...passwordForm}>
                        <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                           <FormField
                              control={passwordForm.control}
                              name="currentPassword"
                              render={({ field }) => (
                                 <FormItem>
                                    <FormLabel>{t("profile.currentPassword")}</FormLabel>
                                    <FormControl>
                                       <div className="relative">
                                          <Input type={showCurrentPassword ? "text" : "password"} {...field} />
                                          <Button
                                             type="button"
                                             variant="ghost"
                                             size="sm"
                                             className="absolute right-0 top-0 h-full px-3"
                                             onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                          >
                                             {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                          </Button>
                                       </div>
                                    </FormControl>
                                 </FormItem>
                              )}
                           />

                           <FormField
                              control={passwordForm.control}
                              name="newPassword"
                              render={({ field }) => (
                                 <FormItem>
                                    <FormLabel>{t("resetPassword.newPassword")}</FormLabel>
                                    <FormControl>
                                       <div className="relative">
                                          <Input type={showNewPassword ? "text" : "password"} {...field} />
                                          <Button
                                             type="button"
                                             variant="ghost"
                                             size="sm"
                                             className="absolute right-0 top-0 h-full px-3"
                                             onClick={() => setShowNewPassword(!showNewPassword)}
                                          >
                                             {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                          </Button>
                                       </div>
                                    </FormControl>
                                    <div className="mt-2 space-y-3">
                                       {watchNewPassword && (
                                          <div className="space-y-1">
                                             <p className={`text-sm text-${strengthColor}-500`}>{strengthText}</p>
                                          </div>
                                       )}
                                       {watchNewPassword && (
                                          <div className="space-y-1 text-sm">
                                             <div className="flex items-center gap-2">
                                                {passwordCriteria.length ? (
                                                   <Check className="h-4 w-4 text-green-500" />
                                                ) : (
                                                   <X className="h-4 w-4 text-red-500" />
                                                )}
                                                <span>{t("auth.criteriaLength")}</span>
                                             </div>

                                             <div className="flex items-center gap-2">
                                                {passwordCriteria.lowercase ? (
                                                   <Check className="h-4 w-4 text-green-500" />
                                                ) : (
                                                   <X className="h-4 w-4 text-red-500" />
                                                )}
                                                <span>{t("auth.criteriaLowercase")}</span>
                                             </div>

                                             <div className="flex items-center gap-2">
                                                {passwordCriteria.uppercase ? (
                                                   <Check className="h-4 w-4 text-green-500" />
                                                ) : (
                                                   <X className="h-4 w-4 text-red-500" />
                                                )}
                                                <span>{t("auth.criteriaUppercase")}</span>
                                             </div>

                                             <div className="flex items-center gap-2">
                                                {passwordCriteria.special ? (
                                                   <Check className="h-4 w-4 text-green-500" />
                                                ) : (
                                                   <X className="h-4 w-4 text-red-500" />
                                                )}
                                                <span>{t("auth.criteriaSpecial")}</span>
                                             </div>
                                          </div>
                                       )}
                                    </div>
                                 </FormItem>
                              )}
                           />

                           <FormField
                              control={passwordForm.control}
                              name="confirmPassword"
                              render={({ field }) => (
                                 <FormItem>
                                    <FormLabel>{t("resetPassword.confirmNewPassword")}</FormLabel>
                                    <FormControl>
                                       <div className="relative">
                                          <Input type={showConfirmPassword ? "text" : "password"} {...field} />
                                          <Button
                                             type="button"
                                             variant="ghost"
                                             size="sm"
                                             className="absolute right-0 top-0 h-full px-3"
                                             onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                          >
                                             {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                          </Button>
                                       </div>
                                    </FormControl>
                                    {watchNewPassword && watchConfirmPassword && watchNewPassword !== watchConfirmPassword && (
                                       <p className="text-destructive text-sm mt-1">{t("auth.passwordsDoNotMatch")}</p>
                                    )}
                                 </FormItem>
                              )}
                           />

                           <Button 
                              type="submit" 
                              className="w-full md:w-auto" 
                              disabled={isChangingPassword}
                           >
                              {isChangingPassword ? t("common.updating") : t("profile.updatePassword")}
                           </Button>
                        </form>
                     </Form>
                  </CardContent>
               </Card>

               <Card>
                  <CardHeader>
                     <CardTitle>{t("profile.twoFactor")}</CardTitle>
                     <CardDescription>{t("profile.twoFactorDesc")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                     <Button variant="outline" className="w-full md:w-auto">
                        {t("profile.enable2FA")}
                     </Button>
                  </CardContent>
               </Card>
            </TabsContent>

            {/* Account Management Tab */}
            <TabsContent value="account" className="space-y-4 mt-4">
               {/* TODO : Export Data */}
               {/* <Card>
                  <CardHeader>
                     <CardTitle>{t("profile.exportData")}</CardTitle>
                     <CardDescription>{t("profile.exportDataDesc")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                     <Button variant="outline" className="w-full md:w-auto mb-4">
                        {t("profile.exportTransactions")}
                     </Button>
                     <Button variant="outline" className="w-full md:w-auto">
                        {t("profile.exportAllData")}
                     </Button>
                  </CardContent>
               </Card> */}

               <Card className="border-destructive">
                  <CardHeader>
                     <CardTitle className="text-destructive">{t("profile.dangerZone")}</CardTitle>
                     <CardDescription>{t("profile.dangerZoneDesc")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                     <div className="space-y-4">
                        <div>
                           <h3 className="font-medium mb-1">{t("profile.resetAccount")}</h3>
                           <p className="text-muted-foreground text-sm mb-3">
                              {t("profile.resetAccountDesc")}
                           </p>
                           <AlertDialog>
                              <AlertDialogTrigger asChild>
                                 <Button variant="outline" className="border-destructive text-destructive">
                                    {t("profile.resetAccount")}
                                 </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                 <AlertDialogHeader>
                                    <AlertDialogTitle>{t("profile.confirmReset")}</AlertDialogTitle>
                                    <AlertDialogDescription>
                                       {t("profile.confirmResetDesc")}
                                    </AlertDialogDescription>
                                 </AlertDialogHeader>
                                 <AlertDialogFooter>
                                    <AlertDialogCancel>{t("common.back")}</AlertDialogCancel>
                                    <AlertDialogAction
                                       className="bg-destructive"
                                       onClick={async () => {
                                          try {
                                             const response = await axios.post("/api/profile/reset");
                                             if (response.status === 200) {
                                                toast.success(t("profile.accountReset"));
                                                // Refresh the session to update UI
                                                await update({
                                                   ...session,
                                                   user: {
                                                      ...session?.user,
                                                      hasCompletedOnboarding: false
                                                   }
                                                });
                                                router.push(paths.onboarding);
                                             }
                                          } catch (error) {
                                             toast.error(t("common.errorResettingAccount"));
                                          }
                                       }}
                                    >
                                       {t("profile.resetData")}
                                    </AlertDialogAction>
                                 </AlertDialogFooter>
                              </AlertDialogContent>
                           </AlertDialog>
                        </div>

                        <Separator />

                        <div>
                           <h3 className="font-medium mb-1">{t("profile.deleteAccount")}</h3>
                           <p className="text-muted-foreground text-sm mb-3">
                              {t("profile.deleteAccountDesc")}
                           </p>
                           <AlertDialog open={isDeleting} onOpenChange={setIsDeleting}>
                              <AlertDialogTrigger asChild>
                                 <Button variant="destructive">
                                    {t("profile.deleteAccount")}
                                 </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                 <AlertDialogHeader>
                                    <AlertDialogTitle>{t("profile.confirmDelete")}</AlertDialogTitle>
                                    <AlertDialogDescription>
                                       {t("profile.confirmDeleteDesc")}
                                    </AlertDialogDescription>
                                 </AlertDialogHeader>
                                 <Form {...deleteForm}>
                                    <form onSubmit={deleteForm.handleSubmit(onDeleteSubmit)} className="py-4">
                                       <FormField
                                          control={deleteForm.control}
                                          name="confirmDelete"
                                          render={({ field }) => (
                                             <FormItem>
                                                <FormLabel>{t("profile.typeToConfirm")}</FormLabel>
                                                <FormControl>
                                                   <Input placeholder="DELETE" {...field} />
                                                </FormControl>
                                             </FormItem>
                                          )}
                                       />
                                    </form>
                                 </Form>
                                 <AlertDialogFooter>
                                    <AlertDialogCancel>{t("common.back")}</AlertDialogCancel>
                                    <AlertDialogAction
                                       className="bg-destructive"
                                       onClick={deleteForm.handleSubmit(onDeleteSubmit)}
                                       disabled={deleteForm.formState.isSubmitting || deleteForm.watch("confirmDelete") !== "DELETE"}
                                    >
                                       {t("profile.permanentlyDelete")}
                                    </AlertDialogAction>
                                 </AlertDialogFooter>
                              </AlertDialogContent>
                           </AlertDialog>
                        </div>
                     </div>
                  </CardContent>
               </Card>
            </TabsContent>
         </Tabs>
      </div>
   );
}