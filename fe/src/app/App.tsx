import { useState } from 'react';
import { Header } from './components/Header';
import { DiscoverView } from './components/DiscoverView';
import { MyListingsView } from './components/MyListingsView';
import { MyBookingsView } from './components/MyBookingsView';
import { AddItemView } from './components/AddItemView';
import { ItemDetailModal } from './components/ItemDetailModal';
import { mockUser, mockItems, mockBookings } from './data/mockData';
import { RentalItem, Booking } from './types';
import { Toaster } from './components/ui/sonner';

type View = 'discover' | 'my-listings' | 'my-bookings' | 'add-item';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('discover');
  const [selectedItem, setSelectedItem] = useState<RentalItem | null>(null);
  const [items] = useState(mockItems);
  const [bookings, setBookings] = useState(mockBookings);

  const handleItemClick = (item: RentalItem) => {
    setSelectedItem(item);
  };

  const handleCloseModal = () => {
    setSelectedItem(null);
  };

  const handleBooking = (itemId: string, startTime: Date, endTime: Date) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    const hours = Math.ceil((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60));
    const totalCost = hours * item.hourlyRate;

    const newBooking: Booking = {
      id: `booking-${Date.now()}`,
      itemId: item.id,
      itemTitle: item.title,
      itemImage: item.imageUrl,
      renterId: mockUser.id,
      renterName: mockUser.name,
      ownerId: item.ownerId,
      ownerName: item.ownerName,
      startTime,
      endTime,
      totalHours: hours,
      totalCost,
      status: 'confirmed',
      createdAt: new Date(),
    };

    setBookings([...bookings, newBooking]);
    setSelectedItem(null);
    setCurrentView('my-bookings');
  };

  const handleItemAdded = () => {
    setCurrentView('my-listings');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        currentView={currentView}
        onViewChange={(view) => setCurrentView(view as View)}
        userName={mockUser.name}
        userRating={mockUser.rating}
      />

      {currentView === 'discover' && (
        <DiscoverView items={items} onItemClick={handleItemClick} />
      )}

      {currentView === 'my-listings' && (
        <MyListingsView items={items} userId={mockUser.id} />
      )}

      {currentView === 'my-bookings' && (
        <MyBookingsView bookings={bookings} userId={mockUser.id} />
      )}

      {currentView === 'add-item' && <AddItemView onItemAdded={handleItemAdded} />}

      <ItemDetailModal
        item={selectedItem}
        isOpen={selectedItem !== null}
        onClose={handleCloseModal}
        onBooking={handleBooking}
      />

      <Toaster position="top-center" />
    </div>
  );
}
