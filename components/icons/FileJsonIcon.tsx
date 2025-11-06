import React from 'react';

export const FileJsonIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M10 12.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5" />
    <path d="M14 12.5a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5" />
    <path d="M12 16a2 2 0 0 0 2-2v-1a2 2 0 0 0-4 0v1a2 2 0 0 0 2 2z" />
  </svg>
);
