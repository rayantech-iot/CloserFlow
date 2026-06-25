import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "Minimum 6 caractères"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Email invalide"),
});

export const createUserSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "Minimum 6 caractères"),
  displayName: z.string().min(2, "Minimum 2 caractères"),
  role: z.enum(["admin", "closer"]),
  phone: z.string().optional(),
});

export const updateUserSchema = z.object({
  displayName: z.string().min(2, "Minimum 2 caractères").optional(),
  role: z.enum(["admin", "closer"]).optional(),
  active: z.boolean().optional(),
  phone: z.string().optional(),
});

export const orderNoteSchema = z.object({
  content: z.string().min(1, "La note ne peut pas être vide"),
});

export const statusChangeSchema = z.object({
  status: z.enum([
    "nouvelle",
    "confirmée",
    "programmée",
    "injoignable",
    "faux_numéro",
    "livrée",
    "refusée",
    "annulée",
  ]),
});

export const registerSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "Minimum 6 caractères"),
  displayName: z.string().min(2, "Minimum 2 caractères"),
  organizationName: z.string().min(2, "Minimum 2 caractères"),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type CreateUserFormData = z.infer<typeof createUserSchema>;
export type UpdateUserFormData = z.infer<typeof updateUserSchema>;
export type OrderNoteFormData = z.infer<typeof orderNoteSchema>;
export type StatusChangeFormData = z.infer<typeof statusChangeSchema>;
