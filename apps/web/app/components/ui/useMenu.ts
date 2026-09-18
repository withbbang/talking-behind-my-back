'use client';

import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';

/**
 * 드롭다운 메뉴 공용 동작 (D-034 11, D-035 2). 방 목록 … 메뉴와 사이드바 프로필 메뉴가 같은 규칙을 쓴다.
 * - 열리면 첫 `[role="menuitem"]` 로 포커스, ↑↓ 순환.
 * - 바깥 pointerdown · Escape · 포커스 이탈로 닫힘. Escape 는 트리거로 포커스 복귀.
 * 트리거에 `triggerRef`, 메뉴 컨테이너에 `menuRef` + `menuProps` 를 붙인다.
 */
export function useMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);

  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const idx = items.indexOf(document.activeElement as HTMLElement);
    items[(idx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  };
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    // 포커스가 메뉴 밖으로(탭 이동 등) 나가면 닫힘. 메뉴 안 항목 간 이동은 유지.
    if (!menuRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
  };

  return {
    open,
    toggle: () => setOpen((v) => !v),
    close,
    menuRef,
    triggerRef,
    menuProps: { role: 'menu' as const, onKeyDown, onBlur },
  };
}
