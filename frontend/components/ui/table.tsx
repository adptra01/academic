import * as React from "react";
import { cn } from "../../lib/utils";

function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full border-collapse text-sm", className)} {...props} />
    </div>
  );
}

function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("[&_tr]:border-b [&_tr]:border-rule", className)} {...props} />;
}

function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("border-b border-rule transition-colors duration-200 hover:bg-paper-2", className)} {...props} />;
}

function TableHead({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("tnum border border-rule bg-paper-2 px-2.5 py-2 text-left text-[10.5px] font-medium uppercase tracking-[0.1em] text-ink-3", className)} {...props} />;
}

function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("tnum border border-rule px-2.5 py-2 align-top text-[12.5px] text-ink-2", className)} {...props} />;
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
