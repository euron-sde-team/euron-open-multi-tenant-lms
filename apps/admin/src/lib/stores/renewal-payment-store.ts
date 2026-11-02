import { create } from "zustand";

/**
 * "A renewal payment is open in a Razorpay tab." Not persisted.
 *
 * Lives outside the components that start it on purpose: the strip and the
 * lock screen disappear the moment the payment lands, so whatever watches for
 * that moment (RenewalPaymentWatcher) must outlive them.
 */
interface RenewalPaymentState {
  awaitingSince: number | null;
  start: () => void;
  stop: () => void;
}

export const useRenewalPaymentStore = create<RenewalPaymentState>((set) => ({
  awaitingSince: null,
  start: () => set({ awaitingSince: Date.now() }),
  stop: () => set({ awaitingSince: null }),
}));
