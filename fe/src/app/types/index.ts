export interface RentalItem {
  id: string;
  title: string;
  description: string;
  category: string;
  hourlyRate: number;
  imageUrl: string;
  location: string;
  distance?: number;
  ownerId: string;
  ownerName: string;
  ownerRating: number;
  availability: boolean;
  condition: 'excellent' | 'good' | 'fair';
}

export interface Booking {
  id: string;
  itemId: string;
  itemTitle: string;
  itemImage: string;
  renterId: string;
  renterName: string;
  ownerId: string;
  ownerName: string;
  startTime: Date;
  endTime: Date;
  totalHours: number;
  totalCost: number;
  status: 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled';
  createdAt: Date;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  rating: number;
  totalRentals: number;
}
