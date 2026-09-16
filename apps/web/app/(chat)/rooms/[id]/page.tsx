import { notFound } from 'next/navigation';
import { RoomView } from '@/components/chat/RoomView';

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const roomId = Number(id);
  if (!Number.isInteger(roomId) || roomId <= 0) notFound();
  return <RoomView roomId={roomId} />;
}
