import { useState, useEffect } from "react";
import lf from "localforage";
import { isNil, map } from "ramda";
import SDK from "weavedb-sdk";
import { Box, Flex, Button, ChakraProvider, Radio, RadioGroup, Stack, Heading, Text, Spinner } from "@chakra-ui/react";
import { Web3Provider } from '@ethersproject/providers';
import React, { useMemo } from 'react';

//تعريف معرف معاملة العقد للتفاعل مع العقد الذكي.
const contractTxId = "OtD6vn2WRvTZd7Exw9TSp0p2H0i5_GKbF_gypPzBAf8";


//هذا هو المكون الوظيفي الرئيسي للتطبيق اللامركزي. يقوم بإعداد متغيرات الحالة، معالجة التهيئة، وتحديد هيكل واجهة المستخدم.
export default function VotingDApp() {
  const [user, setUser] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [voted, setVoted] = useState(false);
  const [db, setDb] = useState(null);

//تهيئ مثيل WeaveDB بمعرف معاملة العقد المحدد وتضع المثيل في الحالة. يتم استدعاء هذه الدالة عند تركيب المكون لتحضير قاعدة البيانات للتفاعل.
  const setupWeaveDB = async () => {
    const _db = new SDK({ contractTxId });
    await _db.init();
    setDb(_db);
  };


//جلب قائمة المرشحين من WeaveDB وتحدث الحالة بهذه القائمة. يتم استدعاء هذه الدالة بعد تهيئة قاعدة البيانات لملء قائمة المرشحين.
const getCandidates = async () => {
  if (db) {
    try {
      const result = await db.get("candidates");
      setCandidates(result); 
    } catch (error) {
      console.error('Error fetching candidates:', error);
    }
  }
};



//تسترجع جميع الأصوات من قاعدة البيانات وتقوم بتصفية هذه الأصوات لمعرفة ما إذا كان المستخدم الحالي قد صوت بالفعل. يساعد ذلك في منع 
//التصويت المزدوج من قبل نفس المستخدم.
const getVoteByUserId = async (userId) => {
  const result = await db.get("votes");
  const userVote = result.find(vote => vote.voter_address === userId);
  return userVote;
};



//تسجل تصويتًا للمرشح المحدد
const vote = async () => {
  if (!isNil(selectedCandidate)) {
    try {
      const existingVote = await getVoteByUserId(user.wallet.toLowerCase());
      if (existingVote) {
        alert('You have already voted.');
      } else {
        await db.add(
          {
            voter_address: user.wallet.toLowerCase(),
            timestamp: Date.now(),
            candidate_address: selectedCandidate,
            voted: true
          },
          "votes"
        );
        setVoted(true);
        alert('Your vote has been successfully recorded!');
      }
    } catch (error) {
      console.error('Error recording vote:', error);
      alert('An error occurred while recording your vote. Please try again later.');
    }
  }
};

  
//تقوم هذه الدالة بتحديث الحالة بمعلومات محفظة المستخدم عند تسجيل الدخول بنجاح.

  const login = async () => {
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        const provider = new Web3Provider(window.ethereum, "any");
        await provider.send("eth_requestAccounts", []);
        const walletAddress = await provider.getSigner().getAddress();
        let identity = await lf.getItem(`temp_address:${contractTxId}:${walletAddress}`);
        let tx, err;
        if (isNil(identity)) {
          ({ tx, identity, err } = await db.createTempAddress(walletAddress));
          const linked = await db.getAddressLink(identity.address);
          if (isNil(linked)) {
            alert("Something went wrong");
            return;
          }
        } else {
          await lf.setItem("temp_address:current", walletAddress);
          setUser({
            wallet: walletAddress,
            privateKey: identity.privateKey,
          });
          return;
        }
        if (!isNil(tx) && isNil(tx.err)) {
          identity.tx = tx;
          identity.linked_address = walletAddress;
          await lf.setItem("temp_address:current", walletAddress);
          await lf.setItem(`temp_address:${contractTxId}:${walletAddress}`, JSON.parse(JSON.stringify(identity)));
          setUser({
            wallet: walletAddress,
            privateKey: identity.privateKey,
          });
        }
      } catch (error) {
        console.error("Error logging in:", error);
      }
    } else {
      console.error("Ethereum provider not found");
    }
  };



//تقوم هذه الدالة بتحديث الحالة بمعلومات محفظة المستخدم عند تسجيل الخروج.
  const logout = async () => {
    if (confirm("Would you like to sign out?")) {
      await lf.removeItem("temp_address:current");
      setUser(null);
    }
  };

  const checkUser = async () => {
    const walletAddress = await lf.getItem("temp_address:current");
    if (!isNil(walletAddress)) {
      const identity = await lf.getItem(`temp_address:${contractTxId}:${walletAddress}`);
      if (!isNil(identity)) {
        setUser({
          wallet: walletAddress,
          privateKey: identity.privateKey,
        });
      }
    }
  };

  useEffect(() => {
    checkUser();
    setupWeaveDB();
  }, []);

  useEffect(() => {
    if (db !== null) {
      getCandidates();
    }
  }, [db]);
//يتم تقديم واجهة المستخدم الرئيسية للتطبيق اللامركزي. يتم تقديم شريط التنقل وقائمة المرشحين ورسالة الشكر بناءً على حالة المستخدم والتصويت.
  const NavBar = () => (
    <Flex p={3} position="fixed" w="100%" sx={{ top: 0, left: 0 }}>
      <Box flex={1} />
      <Flex
        bg="#111"
        color="white"
        py={2}
        px={6}
        sx={{
          borderRadius: "5px",
          cursor: "pointer",
          ":hover": { opacity: 0.75 },
        }}
      >
        {!isNil(user) ? (
          <Box onClick={() => logout()}>{user.wallet.slice(0, 7)}</Box>
        ) : (
          <Box onClick={() => login()}>Connect Wallet</Box>
        )}
      </Flex>
    </Flex>
  );



//يتم تقديم قائمة المرشحين وزر التصويت. يتم تعطيل زر التصويت إذا كان المستخدم قد صوت بالفعل أو إذا لم يتم تحديد مرشح.
const CandidateList = () => {
  const memoizedCandidates = useMemo(() => {
    return map((candidate) => (
      <Radio key={candidate.candidate_address} value={candidate.candidate_address} colorScheme="black">
        <Flex align="center">
          <Text mr={5} color="black" fontWeight="bold">{candidate.name}</Text>
          <Text color="black">{candidate.candidate_address}</Text>
        </Flex>
      </Radio>
    ))(candidates);
  }, [candidates]);

  return (
    <Box mt={20}>
      <Heading color="black" mb={5}>Select a candidate to vote:</Heading>
      <RadioGroup onChange={setSelectedCandidate} value={selectedCandidate} colorScheme="green">        
        <Stack spacing={3}>
          {memoizedCandidates}
        </Stack>
      </RadioGroup>
      <Button mt={4} colorScheme="teal" onClick={vote} isDisabled={voted || isNil(selectedCandidate)}>
        {voted ? <Spinner /> : 'Vote'}
      </Button>
    </Box>
  );
};


//يتم تقديم رسالة الشكر بمجرد تسجيل التصويت بنجاح.
  const ThankYouMessage = () => (
    <Box mt={10}>
      <Heading>Thank you for voting!</Heading>
      <Text>Your vote has been recorded.</Text>
    </Box>
  );

  return (
    <ChakraProvider>
      <NavBar />
      <Flex mt="60px" justify="center" p={3}>
        <Box w="100%" maxW="600px">
          {!isNil(user) && !voted ? <CandidateList /> : !isNil(user) && voted ? <ThankYouMessage /> : null}
        </Box>
      </Flex>
    </ChakraProvider>
  );
}
