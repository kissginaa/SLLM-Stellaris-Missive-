#include "bridge-ipc.h"
#include <string.h>
#include <stddef.h>
typedef struct {uint32_t flags,pad;uint64_t reserved;union{char small[16];char*ptr;}data;uint64_t length,capacity;} GameString;
typedef struct {void*vtable;GameString*items;int capacity,count;} GameArray;
typedef struct {uint64_t status;GameString text;} GameResult;
_Static_assert(sizeof(GameString)==48,"game string layout");
_Static_assert(sizeof(GameArray)==24,"game array layout");
_Static_assert(sizeof(GameResult)==56,"game result layout");

static DWORD execute(BridgeRequest*r) {
    if(r->pid!=GetCurrentProcessId()||r->tid!=GetCurrentThreadId())return WRONG_TARGET;
    if(!valid_filename(r->filename))return INVALID_FILE;
    BYTE*base=(BYTE*)GetModuleHandleW(NULL);
    IMAGE_DOS_HEADER*dos=(void*)base;
    IMAGE_NT_HEADERS64*nt=(void*)(base+dos->e_lfanew);
    const BYTE signature[]={0x48,0x89,0x4c,0x24,0x08,0x55,0x53,0x56,0x57};
    if(dos->e_magic!=IMAGE_DOS_SIGNATURE||nt->Signature!=IMAGE_NT_SIGNATURE||
       nt->FileHeader.Machine!=IMAGE_FILE_MACHINE_AMD64||
       nt->FileHeader.TimeDateStamp!=0x6ae49c1b||nt->OptionalHeader.SizeOfImage!=58687488||
       memcmp(base+0xebf9f0,signature,sizeof(signature)))return UNSUPPORTED_BUILD;
    GameString filename={0};
    size_t len=strlen(r->filename);
    memcpy(filename.data.small,r->filename,len+1);
    filename.length=len;filename.capacity=15;
    GameArray args={(void*)(base+0x2302590),&filename,1,1};
    GameResult result={0};
    typedef GameResult*(*Run)(GameResult*,GameArray*,void*);
    typedef void(*Destroy)(GameResult*);
    GameResult*returned=((Run)(base+0xebf9f0))(&result,&args,NULL);
    r->gameStatus=(DWORD)(result.status&255);
    DWORD outcome=(returned==&result&&r->gameStatus==1)?RESULT_OK:COMMAND_FAILED;
    ((Destroy)(base+0x160f20))(&result);
    return outcome;
}

__declspec(dllexport) LRESULT CALLBACK BridgeMessage(int code,WPARAM w,LPARAM l) {
    if(code>=0&&w==PM_REMOVE) {
        MSG*m=(MSG*)l;
        UINT message=RegisterWindowMessageW(BRIDGE_MESSAGE);
        if(message&&m->message==message&&m->lParam==BRIDGE_COOKIE) {
            uint64_t token=(uint64_t)m->wParam;
            m->message=WM_NULL;m->wParam=0;m->lParam=0;
            WCHAR name[128];bridge_name(name,GetCurrentProcessId(),token,L"map");
            HANDLE mapping=OpenFileMappingW(FILE_MAP_ALL_ACCESS,FALSE,name);
            if(mapping) {
                BridgeRequest*r=MapViewOfFile(mapping,FILE_MAP_ALL_ACCESS,0,0,sizeof(BridgeRequest));
                if(r) {
                    if(r->magic==BRIDGE_MAGIC&&r->version==1&&r->token==token&&
                       InterlockedCompareExchange(&r->state,RUNNING,READY)==READY) {
                        r->result=execute(r);
                        InterlockedExchange(&r->state,COMPLETE);
                        bridge_name(name,GetCurrentProcessId(),token,L"done");
                        HANDLE done=OpenEventW(EVENT_MODIFY_STATE,FALSE,name);
                        if(done){SetEvent(done);CloseHandle(done);}
                    }
                    UnmapViewOfFile(r);
                }
                CloseHandle(mapping);
            }
        }
    }
    return CallNextHookEx(NULL,code,w,l);
}
BOOL WINAPI DllMain(HINSTANCE module,DWORD reason,LPVOID reserved) {
    (void)module;(void)reason;(void)reserved;return TRUE;
}
