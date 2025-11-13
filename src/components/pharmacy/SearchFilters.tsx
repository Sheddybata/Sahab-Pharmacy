import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';
import { MedicationCategory } from '@/lib/pharmacy-types';

interface SearchFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  categoryFilter: string;
  onCategoryChange: (value: string) => void;
  stockFilter: string;
  onStockFilterChange: (value: string) => void;
  expiryFilter: string;
  onExpiryFilterChange: (value: string) => void;
}

export const SearchFilters: React.FC<SearchFiltersProps> = ({
  searchTerm,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  stockFilter,
  onStockFilterChange,
  expiryFilter,
  onExpiryFilterChange
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search medications..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>
      
      <Select value={categoryFilter} onValueChange={onCategoryChange}>
        <SelectTrigger>
          <SelectValue placeholder="All Categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          <SelectItem value="Antibiotics">Antibiotics</SelectItem>
          <SelectItem value="Pain Relief">Pain Relief</SelectItem>
          <SelectItem value="Cardiovascular">Cardiovascular</SelectItem>
          <SelectItem value="Diabetes">Diabetes</SelectItem>
          <SelectItem value="Respiratory">Respiratory</SelectItem>
          <SelectItem value="Gastrointestinal">Gastrointestinal</SelectItem>
          <SelectItem value="Vitamins">Vitamins</SelectItem>
          <SelectItem value="Dermatology">Dermatology</SelectItem>
          <SelectItem value="Mental Health">Mental Health</SelectItem>
        </SelectContent>
      </Select>

      <Select value={stockFilter} onValueChange={onStockFilterChange}>
        <SelectTrigger>
          <SelectValue placeholder="Stock Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Stock Levels</SelectItem>
          <SelectItem value="low">Low Stock</SelectItem>
          <SelectItem value="out">Out of Stock</SelectItem>
        </SelectContent>
      </Select>

      <Select value={expiryFilter} onValueChange={onExpiryFilterChange}>
        <SelectTrigger>
          <SelectValue placeholder="Expiry Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Expiry Dates</SelectItem>
          <SelectItem value="expiring">Expiring Soon</SelectItem>
          <SelectItem value="expired">Expired</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
