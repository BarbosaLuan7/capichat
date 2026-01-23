import { useCallback, useState } from 'react';
import { useForm, UseFormReturn, DefaultValues, FieldValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ZodSchema } from 'zod';
import { toast } from 'sonner';
import { getErrorWithFallback } from '@/lib/errorMessages';

/**
 * Options for configuring the useModalForm hook
 */
export interface UseModalFormOptions<TFormData extends FieldValues, TResult = unknown> {
  /** Zod schema for form validation */
  schema: ZodSchema<TFormData>;

  /** Default values for the form fields */
  defaultValues: DefaultValues<TFormData>;

  /**
   * Submit handler that performs the async operation (create/update)
   * @param data - Validated form data
   * @returns Promise with the operation result
   */
  onSubmit: (data: TFormData) => Promise<TResult>;

  /**
   * Callback executed on successful submission
   * @param result - The result returned from onSubmit
   */
  onSuccess?: (result: TResult) => void;

  /**
   * Callback executed when an error occurs
   * @param error - The error that occurred
   */
  onError?: (error: Error) => void;

  /**
   * Toast message shown on success
   * @default 'Operacao realizada com sucesso'
   */
  successMessage?: string;

  /**
   * Toast message shown on error (used as fallback)
   * @default 'Erro ao realizar operacao'
   */
  errorMessage?: string;

  /**
   * Whether to show toast notifications
   * @default true
   */
  showToasts?: boolean;

  /**
   * Whether to reset the form after successful submission
   * @default true
   */
  resetOnSuccess?: boolean;
}

/**
 * Return type for the useModalForm hook
 */
export interface UseModalFormReturn<TFormData extends FieldValues> {
  /** React Hook Form instance with all form methods */
  form: UseFormReturn<TFormData>;

  /** Whether the form is currently submitting */
  isSubmitting: boolean;

  /**
   * Handles form submission with validation, error handling, and toasts
   * Can be passed directly to form onSubmit or called manually
   */
  handleSubmit: () => Promise<void>;

  /**
   * Resets the form to its default values
   * Should be called when the modal closes
   */
  reset: () => void;

  /**
   * Resets the form with new values (useful for edit mode)
   * @param values - New values to reset the form with
   */
  resetWithValues: (values: TFormData) => void;

  /**
   * Whether the form has been modified from its default values
   */
  isDirty: boolean;

  /**
   * Whether the form is valid according to the schema
   */
  isValid: boolean;
}

/**
 * Custom hook that abstracts the common modal form pattern used across the application.
 *
 * This hook combines:
 * - react-hook-form with zodResolver for form management and validation
 * - Loading state management during submission
 * - Toast notifications for success/error feedback
 * - Form reset functionality for modal close/reopen
 *
 * @example
 * ```tsx
 * const { form, isSubmitting, handleSubmit, reset } = useModalForm({
 *   schema: leadSchema,
 *   defaultValues: { name: '', email: '' },
 *   onSubmit: async (data) => {
 *     return await createLead.mutateAsync(data);
 *   },
 *   onSuccess: () => onOpenChange(false),
 *   successMessage: 'Lead criado com sucesso',
 *   errorMessage: 'Erro ao criar lead',
 * });
 *
 * // In your modal close handler:
 * const handleOpenChange = (open: boolean) => {
 *   if (!open) reset();
 *   onOpenChange(open);
 * };
 * ```
 *
 * @param options - Configuration options for the modal form
 * @returns Object with form instance, state, and handlers
 */
export function useModalForm<TFormData extends FieldValues, TResult = unknown>(
  options: UseModalFormOptions<TFormData, TResult>
): UseModalFormReturn<TFormData> {
  const {
    schema,
    defaultValues,
    onSubmit,
    onSuccess,
    onError,
    successMessage = 'Operacao realizada com sucesso',
    errorMessage = 'Erro ao realizar operacao',
    showToasts = true,
    resetOnSuccess = true,
  } = options;

  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<TFormData>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onBlur',
  });

  const handleSubmit = useCallback(async () => {
    // Trigger validation before submission
    const isValid = await form.trigger();
    if (!isValid) return;

    const data = form.getValues();

    setIsSubmitting(true);
    try {
      const result = await onSubmit(data);

      if (showToasts) {
        toast.success(successMessage);
      }

      if (resetOnSuccess) {
        form.reset(defaultValues);
      }

      onSuccess?.(result);
    } catch (error) {
      const errorInstance = error instanceof Error ? error : new Error(String(error));

      if (showToasts) {
        toast.error(getErrorWithFallback(error, errorMessage));
      }

      onError?.(errorInstance);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    form,
    onSubmit,
    onSuccess,
    onError,
    successMessage,
    errorMessage,
    showToasts,
    resetOnSuccess,
    defaultValues,
  ]);

  const reset = useCallback(() => {
    form.reset(defaultValues);
  }, [form, defaultValues]);

  const resetWithValues = useCallback(
    (values: TFormData) => {
      form.reset(values);
    },
    [form]
  );

  return {
    form,
    isSubmitting,
    handleSubmit,
    reset,
    resetWithValues,
    isDirty: form.formState.isDirty,
    isValid: form.formState.isValid,
  };
}

/**
 * Utility type to extract the form data type from a Zod schema
 */
export type InferFormData<T extends ZodSchema> = T extends ZodSchema<infer U> ? U : never;
