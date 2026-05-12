import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
}

export default function Pagination({ 
  currentPage, 
  totalPages, 
  onPageChange, 
  totalItems, 
  itemsPerPage 
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const startIdx = (currentPage - 1) * itemsPerPage + 1;
  const endIdx = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 border-t-2 border-[#141414] bg-white">
      <div className="text-[10px] font-mono font-bold uppercase opacity-50">
        Showing <span className="text-[#141414]">{startIdx}-{endIdx}</span> of <span className="text-[#141414]">{totalItems}</span> Records
      </div>
      
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="p-2 border-2 border-[#141414] hover:bg-[#E4E3E0] disabled:opacity-30 disabled:hover:bg-transparent transition-all"
          title="First Page"
        >
          <ChevronsLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 border-2 border-[#141414] hover:bg-[#E4E3E0] disabled:opacity-30 disabled:hover:bg-transparent transition-all"
          title="Previous Page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        
        <div className="flex items-center px-4 h-full border-y-2 border-[#141414] bg-[#141414] text-[#E4E3E0] text-[10px] font-mono font-bold">
          PAGE {currentPage} OF {totalPages}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 border-2 border-[#141414] hover:bg-[#E4E3E0] disabled:opacity-30 disabled:hover:bg-transparent transition-all"
          title="Next Page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="p-2 border-2 border-[#141414] hover:bg-[#E4E3E0] disabled:opacity-30 disabled:hover:bg-transparent transition-all"
          title="Last Page"
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
