const LandingLayout = ({ 
    children
 }: {
    children: React.ReactNode;  
 }) => {
    return (
        <div>
            <main className="h-full bg-[#111827] overflow-auto">
                <div className="mx-auto max-w-screen-xl h-full w-full">
                    {children}
                </div>
            </main>
        </div>
    );
}

export default LandingLayout