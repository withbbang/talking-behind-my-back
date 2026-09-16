import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { RoomListItem } from './RoomListItem';
import { roomItem } from '@/features/rooms/testFixtures';

const now = new Date('2026-09-16T12:00:00Z');
const noop = { onRename: vi.fn(), onLeave: vi.fn() };

describe('RoomListItem (DESIGN.md#2 방 목록 항목)', () => {
  it('제목·상대 시간·링크, 개설자면 주인 배지', () => {
    render(<RoomListItem room={roomItem(1, { title: '오늘 뭐 먹지', lastMessageAt: '2026-09-16T11:15:00Z' })} active={false} now={now} {...noop} />);
    expect(screen.getByRole('link', { name: /오늘 뭐 먹지/ })).toHaveAttribute('href', '/rooms/1');
    expect(screen.getByText('45분 전')).toBeInTheDocument();
    expect(screen.getByText('주인')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'AI' })).toBeInTheDocument();
  });

  it('참여자면 배지 없이 보조 줄, 2명이면 사람 아바타', () => {
    render(<RoomListItem room={roomItem(2, { role: 'PARTICIPANT', memberCount: 2 })} active={false} now={now} {...noop} />);
    expect(screen.queryByText('주인')).toBeNull();
    expect(screen.getByText('초대받은 방')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'AI' })).toBeNull();
  });

  it('ORPHANED 는 닫힘 배지', () => {
    render(<RoomListItem room={roomItem(3, { role: 'PARTICIPANT', status: 'ORPHANED' })} active={false} now={now} {...noop} />);
    expect(screen.getByText('닫힘')).toBeInTheDocument();
  });

  it('메시지 없으면 시간 대신 "새 방"', () => {
    render(<RoomListItem room={roomItem(4)} active={false} now={now} {...noop} />);
    expect(screen.getByText('새 방')).toBeInTheDocument();
  });

  it('활성 항목은 aria-current=page', () => {
    render(<RoomListItem room={roomItem(1)} active now={now} {...noop} />);
    expect(screen.getByRole('link')).toHaveAttribute('aria-current', 'page');
  });

  it('메뉴: 개설자는 제목 수정 + 나가기, 참여자는 나가기만', () => {
    const { unmount } = render(<RoomListItem room={roomItem(1)} active={false} now={now} {...noop} />);
    fireEvent.click(screen.getByRole('button', { name: '방 메뉴' }));
    expect(screen.getByRole('menuitem', { name: '제목 수정' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: '나가기' })).toBeInTheDocument();
    unmount();

    render(<RoomListItem room={roomItem(2, { role: 'PARTICIPANT' })} active={false} now={now} {...noop} />);
    fireEvent.click(screen.getByRole('button', { name: '방 메뉴' }));
    expect(screen.queryByRole('menuitem', { name: '제목 수정' })).toBeNull();
    expect(screen.getByRole('menuitem', { name: '나가기' })).toBeInTheDocument();
  });

  it('제목 수정: 인라인 입력, Enter 로 onRename(trim), Escape 로 취소', () => {
    const onRename = vi.fn();
    render(<RoomListItem room={roomItem(1, { title: '옛 제목' })} active={false} now={now} onRename={onRename} onLeave={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '방 메뉴' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '제목 수정' }));

    const input = screen.getByRole('textbox', { name: '방 제목' });
    expect(input).toHaveValue('옛 제목');
    fireEvent.change(input, { target: { value: '  새 제목 ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('새 제목');
    expect(screen.queryByRole('textbox')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '방 메뉴' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '제목 수정' }));
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(onRename).toHaveBeenCalledTimes(1);
  });

  it('빈 제목은 onRename 을 부르지 않는다', () => {
    const onRename = vi.fn();
    render(<RoomListItem room={roomItem(1)} active={false} now={now} onRename={onRename} onLeave={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '방 메뉴' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '제목 수정' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(onRename).not.toHaveBeenCalled();
  });

  it('나가기: 개설자 확인 문구 → 확인 시 onLeave', () => {
    const onLeave = vi.fn();
    render(<RoomListItem room={roomItem(1)} active={false} now={now} onRename={vi.fn()} onLeave={onLeave} />);
    fireEvent.click(screen.getByRole('button', { name: '방 메뉴' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '나가기' }));
    expect(screen.getByRole('dialog', { name: '나가면 이 방은 끝이야. 진짜 갈래?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '나갈래' }));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('나가기: 참여자 확인 문구, 취소하면 onLeave 안 부름', () => {
    const onLeave = vi.fn();
    render(<RoomListItem room={roomItem(2, { role: 'PARTICIPANT' })} active={false} now={now} onRename={vi.fn()} onLeave={onLeave} />);
    fireEvent.click(screen.getByRole('button', { name: '방 메뉴' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '나가기' }));
    expect(screen.getByRole('dialog', { name: '나가면 여기 얘긴 못 봐. 갈래?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '안 갈래' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onLeave).not.toHaveBeenCalled();
  });
});
