import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";

import { APP_CONFIG } from "../constants/config";
import { EmailCodePurpose } from "../types";

const STORAGE_PREFIX = "verification_code_cooldown_until";
const TICK_MS = 1000;

const getCooldownKey = (purpose: EmailCodePurpose, email: string) =>
  `${STORAGE_PREFIX}:${purpose}:${email.trim().toLowerCase()}`;

const getRemainingSeconds = (cooldownUntil: number | null) => {
  if (!cooldownUntil) return 0;
  return Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
};

export const useVerificationCooldown = (
  purpose: EmailCodePurpose,
  email: string,
) => {
  const storageKey = useMemo(() => getCooldownKey(purpose, email), [email, purpose]);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const syncRemaining = useCallback((nextUntil = cooldownUntil) => {
    const nextRemaining = getRemainingSeconds(nextUntil);
    setRemainingSeconds(nextRemaining);
    if (nextRemaining === 0 && nextUntil) {
      setCooldownUntil(null);
      AsyncStorage.removeItem(storageKey).catch(() => {});
    }
  }, [cooldownUntil, storageKey]);

  useEffect(() => {
    let isMounted = true;

    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (!isMounted) return;
        const parsed = raw ? Number(raw) : null;
        const nextUntil =
          parsed && Number.isFinite(parsed) && parsed > Date.now()
            ? parsed
            : null;
        setCooldownUntil(nextUntil);
        setRemainingSeconds(getRemainingSeconds(nextUntil));
        if (!nextUntil && raw) {
          AsyncStorage.removeItem(storageKey).catch(() => {});
        }
      })
      .catch(() => {
        if (isMounted) {
          setCooldownUntil(null);
          setRemainingSeconds(0);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [storageKey]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    syncRemaining(cooldownUntil);

    if (getRemainingSeconds(cooldownUntil) > 0) {
      intervalRef.current = setInterval(() => {
        syncRemaining(cooldownUntil);
      }, TICK_MS);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [cooldownUntil, syncRemaining]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        syncRemaining(cooldownUntil);
      }
    });

    return () => subscription.remove();
  }, [cooldownUntil, syncRemaining]);

  const startCooldown = useCallback((seconds = APP_CONFIG.VALIDATION.VERIFY_CODE_COOLDOWN) => {
    const nextUntil = Date.now() + seconds * 1000;
    setCooldownUntil(nextUntil);
    setRemainingSeconds(getRemainingSeconds(nextUntil));
    AsyncStorage.setItem(storageKey, String(nextUntil)).catch(() => {});
  }, [storageKey]);

  return {
    cooldown: remainingSeconds,
    isCoolingDown: remainingSeconds > 0,
    startCooldown,
  };
};
