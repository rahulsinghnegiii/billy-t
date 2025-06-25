import { useAccount, useConnect, useDisconnect, useContractRead, useContractWrite, useWaitForTransaction } from "wagmi";
import { parseEther, formatEther } from "viem";
import { ReactNode, SetStateAction, createContext, useEffect, useState } from "react";
import { contractAbi } from "../constants";
import { usePublicClient } from "wagmi";

// Define campaign status enum to match contract
enum CampaignStatus {
  Pending = 0,
  Approved = 1,
  Rejected = 2
}

type ParsedCampaign = {
    owner: string
    title: string
    description: string
    target: string
    deadline: number
    amountCollected: string
    image: string
    pId: string
    status: string
    rejectionReason?: string
}

type ParsedDonation = {
    donator: string
    donation: string
}

export type StateContextType = {
    address: string | undefined
    contract: string
    connect: () => void
    disconnect: () => void
    createCampaign: (form: CampaignForm) => Promise<void>
    getCampaigns: () => Promise<ParsedCampaign[]>
    getApprovedCampaigns: () => Promise<ParsedCampaign[]>
    getUserCampaigns: () => Promise<ParsedCampaign[]>
    donate: (pId: string, amount: string) => Promise<any>
    getDonations: (pId: string) => Promise<ParsedDonation[]>
    searchCampaign: string
    setSearchCampaign: (search: SetStateAction<string>) => void
    isAdmin: boolean
    getPendingCampaigns: () => Promise<ParsedCampaign[]>
    approveCampaign: (id: string) => Promise<void>
    rejectCampaign: (id: string, reason: string) => Promise<void>
    refreshCampaigns: () => Promise<void>
    isConnected: boolean
}

export const StateContext = createContext({} as StateContextType)

type StateContextProviderProps = {
    children: ReactNode
}

type CampaignForm = {
    name: string
    title: string
    description: string
    target: string
    deadline: string
    image: string
}

// Contract address
const CONTRACT_ADDRESS = "0x019f55905515e0c9cc4b34ab926028d881c1a31a";

export function StateContextProvider({ children }: StateContextProviderProps) {
    // Wagmi hooks
    const { address, isConnected } = useAccount();
    const { connect: wagmiConnect } = useConnect();
    const { disconnect: wagmiDisconnect } = useDisconnect();
    const publicClient = usePublicClient();
    
    // Contract write functions
    const { writeAsync: createCampaignWrite } = useContractWrite({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: contractAbi,
        functionName: 'createCampaign',
    });

    const { writeAsync: donateToCampaignWrite } = useContractWrite({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: contractAbi,
        functionName: 'donateToCampaign',
    });

    const { writeAsync: approveCampaignWrite } = useContractWrite({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: contractAbi,
        functionName: 'approveCampaign',
    });

    const { writeAsync: rejectCampaignWrite } = useContractWrite({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: contractAbi,
        functionName: 'rejectCampaign',
    });

    const [isAdmin, setIsAdmin] = useState(false);
    
    // Add state to store campaigns and refresh timestamp
    const [allCampaignsCache, setAllCampaignsCache] = useState<ParsedCampaign[]>([]);
    const [lastRefresh, setLastRefresh] = useState(0);

    // Admin features
    useEffect(() => {
        const checkAdminStatus = async () => {
            if (address) {
                try {
                    const adminRole = await publicClient.readContract({
                        address: CONTRACT_ADDRESS as `0x${string}`,
                        abi: contractAbi,
                        functionName: "hasRole",
                        args: ["0x41444d494e5f524f4c45000000000000000000000000000000000000000000", address],
                    });
                    setIsAdmin(!!adminRole);
                } catch (error) {
                    console.error("Error checking admin status:", error);
                    setIsAdmin(false);
                }
            }
        };
        
        if (address) {
            checkAdminStatus();
        }
    }, [address, publicClient]);

    // Helper function to parse campaign status 
    const getCampaignStatusString = (statusCode: number): string => {
        switch(statusCode) {
            case CampaignStatus.Pending: return "Pending";
            case CampaignStatus.Approved: return "Approved";
            case CampaignStatus.Rejected: return "Rejected";
            default: return "Unknown";
        }
    };

    const refreshCampaigns = async () => {
        try {
            const rawCampaigns = await publicClient.readContract({
                address: CONTRACT_ADDRESS as `0x${string}`,
                abi: contractAbi,
                functionName: "getCampaigns",
            });
            
            if (!Array.isArray(rawCampaigns)) return [];
            
            const parsedCampaigns = (rawCampaigns as any[]).map((campaign: any[], id: number) => ({
                owner: campaign[0],
                title: campaign[1],
                description: campaign[2],
                target: formatEther(campaign[3]),
                deadline: Number(campaign[4]),
                amountCollected: formatEther(campaign[5]),
                image: campaign[6],
                status: campaign[9].toString(),
                rejectionReason: campaign[10] || "",
                pId: id.toString()
            }));
            
            setAllCampaignsCache(parsedCampaigns);
            setLastRefresh(Date.now());
            return parsedCampaigns;
        } catch (err) {
            console.error("Error refreshing campaigns:", err);
            return [];
        }
    };

    const getPendingCampaigns = async () => {
        try {
            // First refresh the campaigns or use cached ones
            let campaigns;
            if (Date.now() - lastRefresh > 5000) { // Refresh if older than 5 seconds
                campaigns = await refreshCampaigns();
            } else {
                campaigns = allCampaignsCache;
                if (campaigns.length === 0) {
                    campaigns = await refreshCampaigns();
                }
            }
            
            // Filter pending campaigns - make sure to compare as numbers
            const pendingCampaigns = campaigns.filter((c: ParsedCampaign) => Number(c.status) === CampaignStatus.Pending);
            console.log("Filtered pending campaigns:", pendingCampaigns);
            return pendingCampaigns;
        } catch (err) {
            console.error("Error fetching pending campaigns:", err);
            return [];
        }
    };
    
    const getApprovedCampaigns = async () => {
        try {
            // First refresh the campaigns or use cached ones
            let campaigns;
            if (Date.now() - lastRefresh > 5000) { // Refresh if older than 5 seconds
                campaigns = await refreshCampaigns();
            } else {
                campaigns = allCampaignsCache;
                if (campaigns.length === 0) {
                    campaigns = await refreshCampaigns();
                }
            }
            
            // Filter approved campaigns - make sure to compare as numbers
            const approvedCampaigns = campaigns.filter((c: ParsedCampaign) => Number(c.status) === CampaignStatus.Approved);
            console.log("Filtered approved campaigns:", approvedCampaigns);
            return approvedCampaigns;
        } catch (err) {
            console.error("Error fetching approved campaigns:", err);
            return [];
        }
    };
    
    const approveCampaign = async (id: string) => {
        try {
            console.log("Approving campaign ID:", id);
            const tx = await approveCampaignWrite({
                args: [id],
            });
            
            await publicClient.waitForTransactionReceipt({
                hash: tx.hash,
            });
            
            console.log("Campaign approved successfully");
            
            // Force refresh campaigns after approval
            await refreshCampaigns();
        } catch (error) {
            console.error("Error approving campaign:", error);
            throw error;
        }
    };

    const rejectCampaign = async (id: string, reason: string) => {
        try {
            console.log("Rejecting campaign ID:", id, "Reason:", reason);
            const tx = await rejectCampaignWrite({
                args: [id, reason],
            });
            
            await publicClient.waitForTransactionReceipt({
                hash: tx.hash,
            });
            
            console.log("Campaign rejected successfully");
            
            // Force refresh campaigns after rejection
            await refreshCampaigns();
        } catch (error) {
            console.error("Error rejecting campaign:", error);
            throw error;
        }
    };

    const publishCampaign = async (form: CampaignForm): Promise<void> => {
        try {
            // Convert deadline properly
            const deadlineTimestamp = Math.floor(new Date(form.deadline).getTime() / 1000);
            console.log("Deadline string:", form.deadline);
            console.log("Deadline timestamp:", deadlineTimestamp);
            
            // Log all parameters being sent
            console.log("Creating campaign with params:", {
                owner: address,
                title: form.title,
                description: form.description,
                target: form.target,
                deadline: deadlineTimestamp,
                image: form.image
            });
            
            const tx = await createCampaignWrite({
                args: [
                    address,
                    form.title,
                    form.description,
                    parseEther(form.target),
                    BigInt(deadlineTimestamp),
                    form.image
                ],
            });
    
            console.log("Transaction sent:", tx);
            
            await publicClient.waitForTransactionReceipt({
                hash: tx.hash,
            });
            
            console.log("Campaign created successfully");
            
            await refreshCampaigns();
        } catch (err) {
            console.error("Transaction error details:", err);
            throw err;
        }
    };
    

    const getCampaigns = async () => {
        try {
            // Use cached campaigns if available and recent
            if (allCampaignsCache.length > 0 && Date.now() - lastRefresh < 5000) {
                return allCampaignsCache;
            }
            
            return await refreshCampaigns();
        } catch (err) {
            console.error("Error fetching campaigns:", err);
            return [];
        }
    };
    
    const getUserCampaigns = async () => {
        const allCampaigns = await getCampaigns();
        const filteredCampaigns = allCampaigns.filter((campaign: ParsedCampaign) => campaign.owner === address);
        return filteredCampaigns;
    }

    const donate = async (pId: string, amount: string) => {
        try {
            console.log(`Donating ${amount} ETH to campaign ${pId}`);
            const tx = await donateToCampaignWrite({
                args: [pId],
                value: parseEther(amount),
            });
            
            await publicClient.waitForTransactionReceipt({
                hash: tx.hash,
            });
            
            console.log("Donation successful");
            
            // Force refresh campaigns after donation
            await refreshCampaigns();
            
            return tx;
        } catch (error) {
            console.error("Error donating to campaign:", error);
            throw error;
        }
    }

    const getDonations = async (pId: string) => {
        try {
            // Call getDonators which returns [donators[], donations[]]
            const result = await publicClient.readContract({
                address: CONTRACT_ADDRESS as `0x${string}`,
                abi: contractAbi,
                functionName: "getDonators",
                args: [pId],
            }) as [string[], bigint[]];
            
            const [donators, donations] = result;
            
            // Safely map the arrays
            const parsedDonations = donators.map((donator: string, i: number) => ({
                donator,
                donation: formatEther(donations[i] || BigInt(0))
            }));
            
            return parsedDonations;
        } catch (error) {
            console.error("Error getting donations:", error);
            return [];
        }
    }

    const [searchCampaign, setSearchCampaign] = useState('');

    // Initial campaign load
    useEffect(() => {
        if (isConnected) {
            refreshCampaigns();
        }
    }, [isConnected]);

    // Simple connect function
    const connect = () => {
        wagmiConnect();
    };

    // Simple disconnect function
    const disconnect = () => {
        wagmiDisconnect();
    };

    return (
        <StateContext.Provider value={{
            address,
            contract: CONTRACT_ADDRESS,
            connect,
            disconnect,
            createCampaign: publishCampaign,
            getCampaigns,
            getApprovedCampaigns,
            getUserCampaigns,
            donate,
            getDonations,
            searchCampaign,
            setSearchCampaign,
            isAdmin,
            getPendingCampaigns,
            approveCampaign,
            rejectCampaign,
            refreshCampaigns,
            isConnected
        }}>
            {children}
        </StateContext.Provider>
    )
}