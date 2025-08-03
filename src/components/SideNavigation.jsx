import React from "react";
import { isMobile } from "../utils/helpers";

function SideNavigation({ onPrevious, onNext, showNavButtons }) {
    // Don't render on mobile or if nav buttons shouldn't be shown
    if (isMobile() || !showNavButtons) {
        return null;
    }

    return (
        <div className="fixed right-4 top-1/2 transform -translate-y-1/2 z-30 flex flex-col gap-2 p-2 bg-black-shades-1000 rounded-2xl">
            {/* Previous button - up arrow */}
            <button
                onClick={onPrevious}
                className="nav-button bg-black-shades-700 text-gray-200 border-none p-2 rounded-xl cursor-pointer text-lg transition-all duration-200 ease-in-out hover:bg-white hover:bg-opacity-20 active:scale-95 min-w-10 min-h-10"
                title="Previous (↑)"
            >
                ↑
            </button>

            {/* Next button - down arrow */}
            <button
                onClick={onNext}
                className="nav-button bg-black-shades-700 text-gray-200 border-none p-2 rounded-xl cursor-pointer text-lg transition-all duration-200 ease-in-out hover:bg-white hover:bg-opacity-20 active:scale-95 min-w-10 min-h-10"
                title="Next (↓)"
            >
                ↓
            </button>
        </div>
    );
}

export default SideNavigation;